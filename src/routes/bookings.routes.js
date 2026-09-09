const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/booking.validators');
const controller = require('../controllers/booking.controller');

router.post('/create-paymentIntent', authenticate, validate(v.createPaymentIntent), controller.createPaymentIntent);
router.post('/configure-stripe', authenticate, validate(v.configureStripe), controller.configureStripe);

router.post('/book-ticket', authenticate, validate(v.bookTicket), controller.bookTicket);
router.post('/cancel-booking', authenticate, validate(v.cancelBooking), controller.cancelBooking);
router.post('/refund-booking', authenticate, validate(v.refundBooking), controller.refundBooking);
router.post('/scan-qr', authenticate, validate(v.scanQr), controller.scanQr);
router.get('/my-tickets', authenticate, validate(v.getUserTickets, 'query'), controller.getUserTickets);
router.get('/booking-detail', authenticate, validate(v.getBookingDetail, 'query'), controller.getBookingDetail);
router.post('/get-tickets-by-events', authenticate, validate(v.getTicketsByEvent), controller.getTicketsByEvent);

module.exports = router;
