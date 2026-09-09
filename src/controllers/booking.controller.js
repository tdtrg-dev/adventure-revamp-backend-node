const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const ticketBookingService = require('../services/ticketBooking.service');
const stripeService = require('../services/stripe.service');

const bookTicket = asyncHandler(async (req, res) => {
  const { booking, message } = await ticketBookingService.bookTicket(req.body);
  return success(res, booking, message, 201);
});

const cancelBooking = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.cancelBooking(req.body.booking_id, req.body.user_id, req.body.cancellation_reason);
  return success(res, data, 'Booking cancelled.');
});

const refundBooking = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.refundBooking(req.body.booking_id, req.body.user_id, req.body.refund_reason);
  return success(res, data, 'Booking refunded successfully.');
});

const scanQr = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.scanQr(req.body.qr_token);
  return success(res, data, 'Valid ticket — entry granted.');
});

const getUserTickets = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.getUserTickets(req.query.user_id, Number(req.query.page) || 1);
  return success(res, data, 'Tickets fetched successfully.');
});

const getBookingDetail = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.getBookingDetail(req.query.booking_id, req.query.user_id);
  return success(res, data, 'Booking detail fetched successfully.');
});

const getTicketsByEvent = asyncHandler(async (req, res) => {
  const data = await ticketBookingService.getTicketsByEvent(req.body.event_id, Number(req.body.page) || 1);
  return success(res, data, 'Event tickets fetched successfully.');
});

const createPaymentIntent = asyncHandler(async (req, res) => {
  const clientSecret = await stripeService.createPaymentIntent(req.body.amount);
  return success(res, clientSecret, 'Client secret');
});

const configureStripe = asyncHandler(async (req, res) => {
  try {
    const url = await stripeService.configureStripe(req.body.user_id, req.headers.origin);
    return success(res, url, 'Stripe Link');
  } catch (err) {
    // Matches Laravel's outer catch: any unexpected failure here (e.g. Stripe API
    // errors) returns 404, distinct from the explicit 400 for "Invalid user id."
    if (!err.statusCode || err.statusCode === 500) err.statusCode = 404;
    throw err;
  }
});

module.exports = {
  bookTicket,
  cancelBooking,
  refundBooking,
  scanQr,
  getUserTickets,
  getBookingDetail,
  getTicketsByEvent,
  createPaymentIntent,
  configureStripe,
};
