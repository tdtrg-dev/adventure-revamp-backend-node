const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const TicketBooking = require('../models/TicketBooking');
const WalletTransaction = require('../models/WalletTransaction');
const { getStripeClient } = require('../integrations/stripe');
const { dateOnly, datetimeStr } = require('../utils/dateFormat');
const env = require('../config/env');

/**
 * A creator_earnings split becomes payable once its event has been ended for
 * this many days — kept as one constant so the report and the actual release
 * check agree. Mirrors PayoutRepository::HOLD_DAYS.
 */
const HOLD_DAYS = 7;

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function paginate(page = 1, perPage = 20) {
  const p = Math.max(1, Number(page) || 1);
  const pp = Math.max(1, Math.min(100, Number(perPage) || 20));
  return { page: p, perPage: pp, skip: (p - 1) * pp };
}

function paginateArray(items, page, perPage) {
  const total = items.length;
  return {
    current_page: page,
    per_page: perPage,
    total,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    data: items.slice((page - 1) * perPage, page * perPage),
  };
}

// ── Wallets ──────────────────────────────────────────────────────────────────

/** Mirrors PayoutRepository::getWallets — only wallets with real activity (Laravel's user_wallets rows are created lazily on first earning). */
async function getWallets({ page, per_page } = {}) {
  const { page: p, perPage, skip } = paginate(page, per_page);

  const query = { 'wallet.total_earned': { $gt: 0 } };
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('name email stripe_account_id wallet')
    .sort({ 'wallet.pending_balance': -1 })
    .skip(skip)
    .limit(perPage);

  const data = users.map((u) => ({
    user_id: u.id,
    name: u.name,
    email: u.email,
    stripe_connected: !!u.stripe_account_id,
    balance: money(u.wallet.balance),
    pending_balance: money(u.wallet.pending_balance),
    total_earned: money(u.wallet.total_earned),
    total_withdrawn: money(u.wallet.total_withdrawn),
    currency: u.wallet.currency,
  }));

  return { current_page: p, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)), data };
}

// ── Per-event payout report ─────────────────────────────────────────────────

/** Mirrors PayoutRepository::getPayoutsReport — one row per event with confirmed sales. */
async function getPayoutsReport({ page, per_page } = {}) {
  const { page: p, perPage } = paginate(page, per_page);

  const bookings = await TicketBooking.find({ status: 'confirmed' })
    .populate({ path: 'event_id', select: 'trip_name end_date organizer_id status', populate: { path: 'organizer_id', select: 'name email stripe_account_id' } })
    .populate('payment.payment_id', 'splits');

  const byEvent = new Map();
  for (const booking of bookings) {
    const event = booking.event_id;
    if (!event) continue;
    const key = String(event._id);
    if (!byEvent.has(key)) byEvent.set(key, { event, bookings: [] });
    byEvent.get(key).bookings.push(booking);
  }

  const now = new Date();
  const rows = [...byEvent.values()].map(({ event, bookings: eventBookings }) => {
    const splits = eventBookings.flatMap((b) => b.payment?.payment_id?.splits || []);
    const creatorSplits = splits.filter((s) => s.split_type === 'creator_earnings');
    const platformSplits = splits.filter((s) => s.split_type === 'platform_fee');

    const pendingAmount = Math.round(creatorSplits.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.amount, 0) * 100) / 100;
    const transferredAmount = Math.round(creatorSplits.filter((s) => s.status === 'transferred').reduce((sum, s) => sum + s.amount, 0) * 100) / 100;

    const eligibleAt = new Date(event.end_date.getTime() + HOLD_DAYS * 86400000);
    const isEligible = pendingAmount > 0 && event.status !== 'cancel' && now >= eligibleAt;

    let payoutStatus = 'holding';
    if (pendingAmount === 0 && transferredAmount > 0) payoutStatus = 'transferred';
    else if (isEligible) payoutStatus = 'eligible';
    else if (pendingAmount > 0 && transferredAmount > 0) payoutStatus = 'partially_transferred';

    return {
      event_id: event.id,
      event_name: event.trip_name,
      event_end_date: dateOnly(event.end_date),
      event_status: event.status,
      organizer: {
        id: event.organizer_id?.id,
        name: event.organizer_id?.name,
        email: event.organizer_id?.email,
        stripe_connected: !!event.organizer_id?.stripe_account_id,
      },
      gross_sales: money(eventBookings.reduce((sum, b) => sum + b.subtotal, 0)),
      platform_fee_collected: money(platformSplits.reduce((sum, s) => sum + s.amount, 0)),
      organizer_pending: money(pendingAmount),
      organizer_transferred: money(transferredAmount),
      eligible_release_date: dateOnly(eligibleAt),
      payout_status: payoutStatus,
    };
  });

  return paginateArray(rows, p, perPage);
}

// ── Organizer drill-down ────────────────────────────────────────────────────

/** Mirrors PayoutRepository::getOrganizerDetail. */
async function getOrganizerDetail(organizerId) {
  const user = await User.findById(organizerId).select('name email stripe_account_id wallet');
  if (!user) throw fail('Organizer not found.', 404);

  const payments = await Payment.find({ 'splits.split_type': 'creator_earnings', 'splits.recipient_type': 'user', 'splits.recipient_id': organizerId }).select('splits paid_at');

  const bookingsByPaymentId = new Map();
  const paymentIds = payments.map((p) => p._id);
  const bookings = await TicketBooking.find({ 'payment.payment_id': { $in: paymentIds } })
    .select('invoice_number event_id payment.payment_id')
    .populate('event_id', 'trip_name end_date');
  bookings.forEach((b) => bookingsByPaymentId.set(String(b.payment.payment_id), b));

  const earnings = [];
  for (const payment of payments) {
    const booking = bookingsByPaymentId.get(String(payment._id));
    for (const split of payment.splits) {
      if (split.split_type !== 'creator_earnings' || split.recipient_type !== 'user' || String(split.recipient_id) !== String(organizerId)) continue;
      earnings.push({
        split_id: split.id,
        amount: money(split.amount),
        status: split.status,
        booking_id: booking?.id || null,
        invoice_number: booking?.invoice_number || null,
        event_name: booking?.event_id?.trip_name || null,
        event_end_date: dateOnly(booking?.event_id?.end_date),
        paid_at: datetimeStr(payment.paid_at),
      });
    }
  }
  earnings.sort((a, b) => (a.split_id < b.split_id ? 1 : -1));

  const payoutDocs = await Payout.find({ user_id: organizerId }).sort({ _id: -1 });
  const payouts = payoutDocs.map((payout) => ({
    payout_id: payout.id,
    amount: money(payout.amount),
    status: payout.status,
    gateway_payout_id: payout.gateway_payout_id,
    initiated_at: datetimeStr(payout.initiated_at),
    completed_at: datetimeStr(payout.completed_at),
    notes: payout.notes,
  }));

  return {
    organizer: { id: user.id, name: user.name, email: user.email, stripe_connected: !!user.stripe_account_id },
    wallet: {
      balance: money(user.wallet.balance),
      pending_balance: money(user.wallet.pending_balance),
      total_earned: money(user.wallet.total_earned),
      total_withdrawn: money(user.wallet.total_withdrawn),
    },
    earnings,
    payouts,
  };
}

// ── Release / retry ──────────────────────────────────────────────────────────

/**
 * Finds every still-pending creator_earnings split for this organizer whose
 * booking is confirmed and whose event ended at least HOLD_DAYS ago (and
 * wasn't cancelled) — mirrors eligibleCreatorSplitsQuery. Splits live embedded
 * inside Payment documents, so this is a 3-hop aggregation: Payment -> (the
 * TicketBooking that references it) -> Event.
 */
async function findEligibleSplits(organizerId) {
  const cutoff = new Date(Date.now() - HOLD_DAYS * 86400000);
  const organizerObjectId = new mongoose.Types.ObjectId(organizerId);

  const splitMatch = { 'splits.split_type': 'creator_earnings', 'splits.recipient_type': 'user', 'splits.recipient_id': organizerObjectId, 'splits.status': 'pending' };

  return Payment.aggregate([
    { $match: splitMatch },
    { $unwind: '$splits' },
    { $match: splitMatch },
    { $lookup: { from: 'ticketbookings', localField: '_id', foreignField: 'payment.payment_id', as: 'booking' } },
    { $unwind: '$booking' },
    { $match: { 'booking.status': 'confirmed' } },
    { $lookup: { from: 'events', localField: 'booking.event_id', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $match: { 'event.status': { $ne: 'cancel' }, 'event.end_date': { $lte: cutoff } } },
    { $project: { payment_id: '$_id', split: '$splits' } },
  ]);
}

/**
 * Mirrors PayoutRepository::releasePayout. Moves real money via a Stripe
 * Transfer — there is no automatic/scheduled release, an admin triggers this
 * explicitly. Not wrapped in a Mongo transaction: no part of this codebase
 * uses multi-document transactions (see ticketBooking.service.js's own
 * booking-confirm/refund flows), so this stays consistent with that.
 */
async function releasePayout(adminId, organizerId) {
  const organizer = await User.findById(organizerId).select('name wallet stripe_account_id');
  if (!organizer) throw fail('Organizer not found.');
  if (!organizer.stripe_account_id) throw fail('This organizer has not connected a Stripe account yet.');

  const stripe = getStripeClient();

  let account;
  try {
    account = await stripe.accounts.retrieve(organizer.stripe_account_id);
  } catch (e) {
    throw fail(`Could not verify the organizer's Stripe Connect account: ${e.message}`);
  }
  if (account.capabilities?.transfers !== 'active') {
    throw fail("The organizer's Stripe Connect account has not completed onboarding (transfers capability is not active).");
  }

  const eligible = await findEligibleSplits(organizerId);
  if (eligible.length === 0) throw fail('No eligible earnings are ready for payout yet.');

  const amount = Math.round(eligible.reduce((sum, row) => sum + row.split.amount, 0) * 100) / 100;
  if (amount <= 0) throw fail('Eligible payout amount is zero.');

  const payout = await Payout.create({
    admin_id: adminId,
    user_id: organizer._id,
    amount,
    currency: env.payment.defaultCurrency,
    status: 'processing',
    gateway: 'stripe',
    initiated_at: new Date(),
  });

  let transfer;
  try {
    transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: (env.payment.defaultCurrency || 'usd').toLowerCase(),
      destination: organizer.stripe_account_id,
      transfer_group: `payout_${payout.id}`,
      metadata: { payout_id: payout.id, organizer_id: organizer.id },
    });
  } catch (e) {
    payout.status = 'failed';
    payout.gateway_response = { error: e.message };
    await payout.save();
    throw fail(`Stripe transfer failed: ${e.message}`);
  }

  payout.status = 'completed';
  payout.gateway_payout_id = transfer.id;
  payout.gateway_response = transfer;
  payout.completed_at = new Date();
  await payout.save();

  await Promise.all(
    eligible.map((row) =>
      Payment.updateOne({ _id: row.payment_id, 'splits._id': row.split._id }, { $set: { 'splits.$.status': 'transferred', 'splits.$.payout_id': payout._id } })
    )
  );

  const balanceBefore = organizer.wallet.pending_balance || 0;
  organizer.wallet.pending_balance = Math.max(0, balanceBefore - amount);
  organizer.wallet.total_withdrawn = (organizer.wallet.total_withdrawn || 0) + amount;
  await organizer.save();

  await WalletTransaction.create({
    user_id: organizer._id,
    transaction_type: 'debit',
    source_type: 'payout',
    source_id: payout._id,
    amount,
    balance_before: balanceBefore,
    balance_after: Math.max(0, balanceBefore - amount),
    description: `Payout #${payout.id} transferred to organizer`,
  });

  return { payout_id: payout.id, amount: money(amount), gateway_payout_id: payout.gateway_payout_id, status: payout.status };
}

/** Mirrors PayoutRepository::retryPayout — the failed attempt made no balance/split changes, so this just re-evaluates and creates a fresh Payout. */
async function retryPayout(adminId, payoutId) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw fail('Payout not found.');
  if (payout.status !== 'failed') throw fail('Only a failed payout can be retried.');

  return releasePayout(adminId, payout.user_id);
}

module.exports = { getWallets, getPayoutsReport, getOrganizerDetail, releasePayout, retryPayout };
