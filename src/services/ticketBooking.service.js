const crypto = require('crypto');
const Event = require('../models/Event');
const TicketBooking = require('../models/TicketBooking');
const TicketCategory = require('../models/TicketCategory');
const User = require('../models/User');
const Group = require('../models/Group');
const Conversation = require('../models/Conversation');
const paymentService = require('./payment.service');
const { nextInvoiceNumber } = require('../utils/invoice');
const { sendEmailViaMailgun } = require('../integrations/mailgun');
const { dateOnly, datetimeStr } = require('../utils/dateFormat');

function notFound(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

async function joinEventGroup(eventId, userId) {
  const group = await Group.findOne({ event_id: eventId, group_type: 'event' });
  if (!group) return;

  if (!group.members.some((m) => String(m.user_id) === String(userId))) {
    group.members.push({ user_id: userId, status: 'approved', member_type: 'member' });
    await group.save();
  }

  const conversation = await Conversation.findOne({ group_id: group._id, is_group: true });
  if (conversation && !conversation.participants.some((p) => String(p.user_id) === String(userId))) {
    conversation.participants.push({ user_id: userId });
    await conversation.save();
  }
}

function sendBookingConfirmationEmail(booking, user, event) {
  sendEmailViaMailgun(
    user.email,
    `Booking Confirmed — ${event.trip_name}`,
    `<p>Your booking (${booking.invoice_number}) for "${event.trip_name}" is confirmed. Total: ${booking.currency} ${money(booking.total_amount)}.</p>`
  ).catch(() => {});
}

function sendBookingOrganizerEmail(booking, organizer, event) {
  if (!organizer?.email) return;
  sendEmailViaMailgun(
    organizer.email,
    `New booking for ${event.trip_name}`,
    `<p>A new booking (${booking.invoice_number}) was made for your event "${event.trip_name}".</p>`
  ).catch(() => {});
}

async function bookTicket(data) {
  const { event_id: eventId, user_id: userId, contact_number: contactNumber, stripe_payment_id: stripePaymentId, items } = data;

  const event = await Event.findById(eventId);
  if (!event) throw notFound('Event not found.');

  const priceMap = new Map(event.prices.map((p) => [String(p._id), p]));

  const bookedByPrice = new Map();
  const existingConfirmedOrPending = await TicketBooking.find({ event_id: eventId, status: { $in: ['confirmed', 'pending'] } }).select('items');
  existingConfirmedOrPending.forEach((b) => {
    b.items.forEach((i) => {
      const key = String(i.event_price_id);
      bookedByPrice.set(key, (bookedByPrice.get(key) || 0) + i.quantity);
    });
  });

  const lineItems = [];
  let subtotal = 0;

  for (const item of items) {
    const priceRow = priceMap.get(String(item.event_price_id));
    if (!priceRow) throw notFound(`Ticket category ID ${item.event_price_id} not found for this event.`);

    if (priceRow.is_unlimited_tickets !== 'yes') {
      const sold = bookedByPrice.get(String(priceRow._id)) || 0;
      const available = priceRow.ticket_quantity - sold;
      if (item.quantity > available) throw notFound(`Only ${available} tickets available for this category.`);
    }

    const lineTotal = Math.round(priceRow.price * item.quantity * 100) / 100;
    subtotal += lineTotal;

    for (let i = 0; i < item.quantity; i++) {
      lineItems.push({
        event_price_id: priceRow._id,
        ticket_cat_id: priceRow.ticket_cat_id,
        quantity: 1,
        unit_price: priceRow.price,
        line_total: priceRow.price,
        person_name: item.person_name || null,
        person_email: item.person_email || null,
        qr_token: crypto.randomUUID(),
        status: 'pending',
      });
    }
  }

  const isFree = subtotal === 0;
  const gateway = isFree ? 'free' : 'stripe';

  const portalFeeRate = isFree ? 0 : await paymentService.getActivePortalFeeRate('ticket');
  const customerPortalFee = isFree ? 0 : Math.round(subtotal * (portalFeeRate / 2) * 100) / 100;
  const organizerPortalFee = isFree ? 0 : Math.round(subtotal * (portalFeeRate / 2) * 100) / 100;
  const totalPortalFee = customerPortalFee + organizerPortalFee;

  const taxAmount = isFree ? 0 : await paymentService.getActiveGeneralTaxAmount('ticket', subtotal);
  const totalAmount = Math.round((subtotal + customerPortalFee + taxAmount) * 100) / 100;
  const organizerNetAmount = Math.round((subtotal - organizerPortalFee) * 100) / 100;

  if (!isFree && stripePaymentId) {
    const existingPayment = await require('../models/Payment').findOne({ gateway_transaction_id: stripePaymentId });
    if (existingPayment) {
      const existingBooking = await TicketBooking.findOne({ 'payment.payment_id': existingPayment._id });
      if (existingBooking) {
        return { booking: await formatBookingResponse(existingBooking), message: 'Booking already processed.' };
      }
    }
  }

  const invoiceNumber = await nextInvoiceNumber('TKT');

  const booking = await TicketBooking.create({
    event_id: eventId,
    user_id: userId,
    contact_number: contactNumber || null,
    status: isFree ? 'confirmed' : 'pending',
    qr_token: crypto.randomUUID(),
    subtotal,
    tax_amount: taxAmount,
    portal_fee_rate: portalFeeRate,
    customer_portal_fee: customerPortalFee,
    organizer_portal_fee: organizerPortalFee,
    organizer_net_amount: organizerNetAmount,
    total_amount: isFree ? 0 : totalAmount,
    invoice_number: invoiceNumber,
    items: lineItems.map((i) => ({ ...i, status: isFree ? 'confirmed' : 'pending' })),
  });

  if (!isFree) {
    const platformAdminId = await paymentService.getPlatformAdminId();

    const payment = await paymentService.createPayment({
      payer_type: 'user',
      payer_id: userId,
      payee_type: 'admin',
      payee_id: platformAdminId,
      payment_type: 'ticket_purchase',
      amount: totalAmount,
      subtotal,
      tax_amount: taxAmount,
      gateway,
      gateway_transaction_id: stripePaymentId,
      status: 'completed',
      description: `Ticket booking #${booking.id} for event: ${event.trip_name}`,
      metadata: { booking_id: booking.id, portal_fee_rate: portalFeeRate, customer_portal_fee: customerPortalFee, organizer_portal_fee: organizerPortalFee, organizer_net_amount: organizerNetAmount },
    });

    const splits = [
      { split_type: 'platform_fee', recipient_type: 'admin', recipient_id: platformAdminId, amount: totalPortalFee, percentage: portalFeeRate, status: 'pending' },
      { split_type: 'creator_earnings', recipient_type: 'user', recipient_id: event.organizer_id, amount: organizerNetAmount, percentage: Math.round((1 - portalFeeRate / 2) * 10000) / 10000, status: 'pending' },
    ];
    if (taxAmount > 0) {
      splits.push({ split_type: 'tax', recipient_type: 'admin', recipient_id: platformAdminId, amount: taxAmount, percentage: null, status: 'pending' });
    }
    payment.splits = splits;
    await payment.save();

    booking.payment.payment_id = payment._id;
    booking.status = 'confirmed';
    booking.items.forEach((i) => (i.status = 'confirmed'));
    await booking.save();

    const organizer = await User.findById(event.organizer_id).select('wallet');
    const balanceBefore = organizer.wallet.pending_balance || 0;
    organizer.wallet.pending_balance = balanceBefore + organizerNetAmount;
    organizer.wallet.total_earned = (organizer.wallet.total_earned || 0) + organizerNetAmount;
    await organizer.save();

    await require('../models/WalletTransaction').create({
      user_id: event.organizer_id,
      transaction_type: 'credit',
      source_type: 'ticket_sale',
      source_id: payment._id,
      amount: organizerNetAmount,
      balance_before: balanceBefore,
      balance_after: balanceBefore + organizerNetAmount,
      description: `Ticket sale — booking #${booking.id} (net after ${organizerPortalFee} portal fee deduction)`,
    });
  }

  await joinEventGroup(eventId, userId);

  const buyer = await User.findById(userId).select('name email');
  const organizerUser = await User.findById(event.organizer_id).select('name email');
  sendBookingConfirmationEmail(booking, buyer, event);
  sendBookingOrganizerEmail(booking, organizerUser, event);

  return { booking: await formatBookingResponse(booking), message: 'Ticket booked successfully.' };
}

async function formatBookingResponse(booking) {
  const catIds = booking.items.map((i) => i.ticket_cat_id);
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));

  return {
    booking_id: booking.id,
    invoice_number: booking.invoice_number,
    qr_token: booking.qr_token,
    status: booking.status,
    subtotal: money(booking.subtotal),
    customer_portal_fee: money(booking.customer_portal_fee),
    tax_amount: money(booking.tax_amount),
    total_amount: money(booking.total_amount),
    currency: booking.currency,
    items: booking.items.map((i) => ({
      item_id: i._id.toString(),
      ticket_category: catMap.get(String(i.ticket_cat_id)) || null,
      qr_token: i.qr_token,
      status: i.status,
      scanned_at: i.scanned_at ? i.scanned_at.toISOString().replace('T', ' ').slice(0, 19) : null,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.line_total,
      person_name: i.person_name,
      person_email: i.person_email,
    })),
    payment_id: booking.payment?.payment_id ? booking.payment.payment_id.toString() : null,
  };
}

async function cancelBooking(bookingId, userId, reason) {
  const booking = await TicketBooking.findOne({ _id: bookingId, user_id: userId });
  if (!booking) throw notFound('Booking not found.');

  if (!['confirmed', 'pending'].includes(booking.status)) {
    throw notFound(`Booking cannot be cancelled — current status: ${booking.status}`);
  }

  booking.status = 'cancelled';
  booking.cancelled_at = new Date();
  booking.cancellation_reason = reason || '';
  booking.items.forEach((i) => (i.status = 'cancelled'));
  await booking.save();

  return { booking_id: booking.id, status: 'cancelled' };
}

async function refundBooking(bookingId, userId, reason) {
  const booking = await TicketBooking.findOne({ _id: bookingId, user_id: userId }).populate('event_id');
  if (!booking) throw notFound('Booking not found.');

  if (!['confirmed', 'cancelled'].includes(booking.status)) {
    throw notFound(`Booking cannot be refunded — current status: ${booking.status}`);
  }
  if (booking.status === 'refunded') throw notFound('Booking is already refunded.');
  if (booking.total_amount === 0) throw notFound('Free bookings cannot be refunded.');
  if (!booking.payment.payment_id) throw notFound('No eligible payment found for refund.');

  const Payment = require('../models/Payment');
  const originalPayment = await Payment.findById(booking.payment.payment_id);
  if (!originalPayment || originalPayment.status === 'refunded') {
    throw notFound('No eligible payment found for refund.');
  }

  const refundAmount = originalPayment.amount;
  const platformAdminId = await paymentService.getPlatformAdminId();

  const refundPayment = await paymentService.createPayment({
    payer_type: 'admin',
    payer_id: platformAdminId,
    payee_type: 'user',
    payee_id: booking.user_id,
    payment_type: 'refund',
    amount: refundAmount,
    subtotal: refundAmount,
    gateway: originalPayment.gateway,
    gateway_transaction_id: `refund_${originalPayment.gateway_transaction_id}`,
    status: 'completed',
    description: `Refund for booking #${booking.id}`,
    metadata: { original_payment_id: originalPayment.id, booking_id: booking.id, reason },
  });

  booking.payment.refund_payment_id = refundPayment._id;
  booking.payment.refund_amount = refundAmount;
  booking.payment.refunded_at = new Date();
  booking.payment.refund_reason = reason || '';

  originalPayment.status = 'refunded';
  await originalPayment.save();

  const organizerId = booking.event_id.organizer_id;
  let creatorEarnings = Number(booking.organizer_net_amount || 0);
  if (creatorEarnings <= 0) {
    const split = originalPayment.splits.find((s) => s.split_type === 'creator_earnings');
    creatorEarnings = split ? split.amount : 0;
  }

  if (creatorEarnings > 0) {
    const organizer = await User.findById(organizerId).select('wallet');
    const balanceBefore = organizer.wallet.pending_balance || 0;
    const deducted = Math.min(creatorEarnings, balanceBefore);
    organizer.wallet.pending_balance = Math.max(0, balanceBefore - creatorEarnings);
    organizer.wallet.total_earned = Math.max(0, (organizer.wallet.total_earned || 0) - Math.min(creatorEarnings, organizer.wallet.total_earned || 0));
    await organizer.save();

    await require('../models/WalletTransaction').create({
      user_id: organizerId,
      transaction_type: 'debit',
      source_type: 'refund',
      source_id: refundPayment._id,
      amount: creatorEarnings,
      balance_before: balanceBefore,
      balance_after: Math.max(0, balanceBefore - creatorEarnings),
      description: `Refund reversal — booking #${booking.id}`,
    });
  }

  booking.status = 'refunded';
  booking.refunded_at = new Date();
  booking.items.forEach((i) => (i.status = 'refunded'));
  await booking.save();

  return { booking_id: booking.id, status: 'refunded' };
}

async function scanQr(qrToken) {
  const booking = await TicketBooking.findOne({ 'items.qr_token': qrToken }).populate('user_id', 'name email').populate('event_id', 'trip_name');
  if (!booking) throw notFound('Invalid QR code.');

  const item = booking.items.find((i) => i.qr_token === qrToken);
  const category = await TicketCategory.findById(item.ticket_cat_id).select('title');

  if (['cancelled', 'refunded'].includes(item.status)) {
    throw notFound(`This ticket is ${item.status} — entry not allowed.`);
  }
  if (item.status === 'used') {
    throw notFound(`This ticket was already scanned at ${item.scanned_at.toISOString().replace('T', ' ').slice(0, 19)}`);
  }
  if (item.status !== 'confirmed') {
    throw notFound('This ticket is not confirmed yet.');
  }

  item.status = 'used';
  item.scanned_at = new Date();
  await booking.save();

  return {
    ticket_item_id: item._id.toString(),
    booking_id: booking.id,
    event: booking.event_id.trip_name,
    attendee_name: item.person_name || booking.user_id.name,
    attendee_email: item.person_email || booking.user_id.email,
    ticket_category: category?.title || null,
    quantity: item.quantity,
    scanned_at: item.scanned_at.toISOString().replace('T', ' ').slice(0, 19),
  };
}

async function getUserTickets(userId, page = 1) {
  const perPage = 15;
  const query = { user_id: userId, status: { $in: ['confirmed', 'cancelled', 'refunded', 'used'] } };

  const total = await TicketBooking.countDocuments(query);
  const bookings = await TicketBooking.find(query)
    .populate({ path: 'event_id', select: 'trip_name location_name media' })
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const data = bookings.map((b) => ({
    booking_id: b.id,
    event_id: b.event_id?.id,
    event_name: b.event_id?.trip_name,
    event_location: b.event_id?.location_name,
    event_image: b.event_id?.media?.length ? b.event_id.media[0].file_path : null,
    event_ticket: b.invoice_number,
    booked_by: String(b.user_id),
    total_booked_tickets: b.items.reduce((sum, i) => sum + i.quantity, 0),
    total_amount: money(b.total_amount),
    currency: b.currency,
    status: b.status,
    booked_at: b.created_at.toISOString().replace('T', ' ').slice(0, 16),
  }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getBookingDetail(bookingId, userId) {
  const booking = await TicketBooking.findOne({ _id: bookingId, user_id: userId }).populate({
    path: 'event_id',
    select: 'trip_name start_date end_date location_name organizer_id media',
    populate: { path: 'organizer_id', select: 'name profile.image' },
  });

  if (!booking) throw notFound('Booking not found.');

  const catIds = booking.items.map((i) => i.ticket_cat_id);
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));
  const buyer = await User.findById(userId).select('name');

  const tickets = booking.items.map((item) => ({
    ticket_id: item._id.toString(),
    price_category: catMap.get(String(item.ticket_cat_id)) || null,
    qr_token: item.qr_token,
    status: item.status,
    scanned_at: item.scanned_at ? item.scanned_at.toISOString().replace('T', ' ').slice(0, 19) : null,
    price: money(item.unit_price),
    quantity: item.quantity,
    line_total: money(item.line_total),
    booking_name: item.person_name || buyer?.name,
    valid_from: dateOnly(booking.event_id.start_date),
    valid_to: dateOnly(booking.event_id.end_date),
    venue: booking.event_id.location_name,
    event_name: booking.event_id.trip_name,
  }));

  return {
    booking_id: booking.id,
    invoice_number: booking.invoice_number,
    status: booking.status,
    contact_number: booking.contact_number,
    booking_date: booking.created_at.toISOString().replace('T', ' ').slice(0, 16),
    subtotal: money(booking.total_amount),
    customer_portal_fee: money(booking.customer_portal_fee),
    tax_amount: money(booking.tax_amount),
    total_amount: money(booking.total_amount),
    currency: booking.currency,
    event_image: booking.event_id.media?.length ? booking.event_id.media[0].file_path : null,
    organizer: {
      id: booking.event_id.organizer_id?.id,
      name: booking.event_id.organizer_id?.name,
      image: booking.event_id.organizer_id?.profile?.image || null,
    },
    tickets,
  };
}

async function getTicketsByEvent(eventId, page = 1) {
  if (!(await Event.exists({ _id: eventId }))) throw notFound('Event not found.');

  const perPage = 20;
  const query = { event_id: eventId, status: { $in: ['confirmed', 'used', 'cancelled', 'refunded'] } };

  const total = await TicketBooking.countDocuments(query);
  const bookings = await TicketBooking.find(query)
    .populate('user_id', 'name email')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const catIds = bookings.flatMap((b) => b.items.map((i) => i.ticket_cat_id));
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));

  const data = bookings.map((b) => ({
    booking_id: b.id,
    invoice_number: b.invoice_number,
    status: b.status,
    currency: b.currency,
    subtotal: money(b.subtotal),
    tax_amount: money(b.tax_amount),
    total_amount: money(b.total_amount),
    total_tickets_booked: b.items.reduce((sum, i) => sum + i.quantity, 0),
    contact_number: b.contact_number,
    scanned_at: b.scanned_at ? b.scanned_at.toISOString().replace('T', ' ').slice(0, 19) : null,
    booked_at: b.created_at.toISOString().replace('T', ' ').slice(0, 19),
    buyer: { id: b.user_id?.id, name: b.user_id?.name, email: b.user_id?.email },
    tickets: b.items.map((i) => ({
      item_id: i._id.toString(),
      category: catMap.get(String(i.ticket_cat_id)) || null,
      quantity: i.quantity,
      unit_price: money(i.unit_price),
      line_total: money(i.line_total),
      person_name: i.person_name,
      person_email: i.person_email,
    })),
  }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

// ── Admin ────────────────────────────────────────────────────────────────────

async function getAllBookings(page = 1) {
  const perPage = 20;
  const total = await TicketBooking.countDocuments();
  const bookings = await TicketBooking.find()
    .populate({ path: 'event_id', select: 'trip_name organizer_id media', populate: { path: 'organizer_id', select: 'name' } })
    .populate('user_id', 'name email')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const data = bookings.map((b) => ({
    booking_id: b.id,
    invoice_number: b.invoice_number,
    status: b.status,
    total_amount: money(b.total_amount),
    currency: b.currency,
    qty: b.items.reduce((sum, i) => sum + i.quantity, 0),
    booked_at: b.created_at.toISOString().replace('T', ' ').slice(0, 16),
    event: {
      id: b.event_id?.id,
      name: b.event_id?.trip_name,
      image: b.event_id?.media?.[0]?.file_path || null,
      organizer_name: b.event_id?.organizer_id?.name,
    },
    booked_by: { id: b.user_id?.id, name: b.user_id?.name, email: b.user_id?.email },
  }));

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getBookingDetailForAdmin(bookingId) {
  const booking = await TicketBooking.findById(bookingId)
    .populate({
      path: 'event_id',
      select: 'trip_name start_date end_date location_name organizer_id media',
      populate: { path: 'organizer_id', select: 'name' },
    })
    .populate('user_id', 'name email')
    .populate('payment.payment_id', 'gateway gateway_transaction_id status paid_at');

  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 400;
    throw err;
  }

  const catIds = booking.items.map((i) => i.ticket_cat_id);
  const categories = await TicketCategory.find({ _id: { $in: catIds } }).select('title');
  const catMap = new Map(categories.map((c) => [String(c._id), c.title]));

  return {
    booking_id: booking.id,
    invoice_number: booking.invoice_number,
    qr_token: booking.qr_token,
    status: booking.status,
    contact_number: booking.contact_number,
    subtotal: money(booking.subtotal),
    tax_amount: money(booking.tax_amount),
    portal_fee_rate: `${Math.round(booking.portal_fee_rate * 100 * 100) / 100}%`,
    customer_portal_fee: money(booking.customer_portal_fee),
    organizer_portal_fee: money(booking.organizer_portal_fee),
    organizer_net_amount: money(booking.organizer_net_amount),
    total_amount: money(booking.total_amount),
    currency: booking.currency,
    booked_at: booking.created_at.toISOString().replace('T', ' ').slice(0, 16),
    cancelled_at: booking.cancelled_at ? booking.cancelled_at.toISOString().replace('T', ' ').slice(0, 16) : null,
    cancellation_reason: booking.cancelled_reason,
    refunded_at: booking.payment.refunded_at ? booking.payment.refunded_at.toISOString().replace('T', ' ').slice(0, 16) : null,
    scanned_at: booking.scanned_at ? booking.scanned_at.toISOString().replace('T', ' ').slice(0, 16) : null,
    event: {
      id: booking.event_id?.id,
      name: booking.event_id?.trip_name,
      image: booking.event_id?.media?.[0]?.file_path || null,
      start_date: dateOnly(booking.event_id?.start_date),
      end_date: dateOnly(booking.event_id?.end_date),
      location: booking.event_id?.location_name,
      organizer_name: booking.event_id?.organizer_id?.name,
    },
    booked_by: { id: booking.user_id?.id, name: booking.user_id?.name, email: booking.user_id?.email },
    payment: booking.payment.payment_id
      ? {
          gateway: booking.payment.payment_id.gateway,
          transaction_id: booking.payment.payment_id.gateway_transaction_id,
          status: booking.payment.payment_id.status,
          paid_at: datetimeStr(booking.payment.payment_id.paid_at),
        }
      : null,
    tickets: booking.items.map((item) => ({
      item_id: item._id.toString(),
      category: catMap.get(String(item.ticket_cat_id)) || null,
      qr_token: item.qr_token,
      status: item.status,
      scanned_at: item.scanned_at ? item.scanned_at.toISOString().replace('T', ' ').slice(0, 19) : null,
      quantity: item.quantity,
      unit_price: money(item.unit_price),
      line_total: money(item.line_total),
      person_name: item.person_name,
      person_email: item.person_email,
    })),
  };
}

module.exports = {
  bookTicket,
  cancelBooking,
  refundBooking,
  scanQr,
  getUserTickets,
  getBookingDetail,
  getTicketsByEvent,
  getAllBookings,
  getBookingDetailForAdmin,
};
