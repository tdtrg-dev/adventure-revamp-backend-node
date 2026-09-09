const Joi = require('joi');
const { objectId } = require('./common');

const bookTicket = Joi.object({
  event_id: objectId().required(),
  user_id: objectId().required(),
  contact_number: Joi.string().max(30).allow(null, ''),
  stripe_payment_id: Joi.string().allow(null, ''),
  items: Joi.array()
    .items(
      Joi.object({
        event_price_id: objectId().required(),
        quantity: Joi.number().integer().min(1).required(),
        person_name: Joi.string().max(150).allow(null, ''),
        person_email: Joi.string().email().max(150).allow(null, ''),
      })
    )
    .min(1)
    .required()
    .messages({ 'array.min': 'At least one ticket item is required.' }),
});

const cancelBooking = Joi.object({
  booking_id: objectId().required(),
  user_id: objectId().required(),
  cancellation_reason: Joi.string().max(500).allow(null, ''),
});

const refundBooking = Joi.object({
  booking_id: objectId().required(),
  user_id: objectId().required(),
  refund_reason: Joi.string().max(500).allow(null, ''),
});

const scanQr = Joi.object({
  qr_token: Joi.string().guid().required(),
});

const getUserTickets = Joi.object({
  user_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const getBookingDetail = Joi.object({
  booking_id: objectId().required(),
  user_id: objectId().required(),
});

const getTicketsByEvent = Joi.object({
  event_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const createPaymentIntent = Joi.object({
  amount: Joi.number().min(1).required(),
});

const configureStripe = Joi.object({
  user_id: objectId().required(),
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
