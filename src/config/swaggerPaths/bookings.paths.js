const { ok, okList, err, unauthorized, auth, body, query } = require('./_helpers');

module.exports = {
  '/create-paymentIntent': {
    post: {
      tags: ['Bookings'],
      summary: 'Create a Stripe PaymentIntent for a ticket checkout',
      ...auth,
      ...body('BookingCreatePaymentIntent'),
      responses: { 200: ok('PaymentIntent created.'), 400: err('Validation failed or free booking.'), 401: unauthorized() },
    },
  },
  '/configure-stripe': {
    post: {
      tags: ['Bookings'],
      summary: "Create/attach the caller's Stripe customer id",
      ...auth,
      ...body('BookingConfigureStripe'),
      responses: { 200: ok('Stripe configured.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/book-ticket': {
    post: {
      tags: ['Bookings'],
      summary: 'Book tickets for an event (any gateway, incl. free/wallet)',
      ...auth,
      ...body('BookingBookTicket'),
      responses: { 200: ok('Booking confirmed.'), 400: err('Validation failed, sold out, or payment failed.'), 401: unauthorized() },
    },
  },
  '/cancel-booking': {
    post: {
      tags: ['Bookings'],
      summary: 'Cancel a ticket booking',
      ...auth,
      ...body('BookingCancelBooking'),
      responses: { 200: ok('Booking cancelled.'), 400: err('Not found or not cancellable.'), 401: unauthorized() },
    },
  },
  '/refund-booking': {
    post: {
      tags: ['Bookings'],
      summary: 'Refund a cancelled/confirmed booking',
      ...auth,
      ...body('BookingRefundBooking'),
      responses: { 200: ok('Refund processed.'), 400: err('Not eligible for refund.'), 401: unauthorized() },
    },
  },
  '/scan-qr': {
    post: {
      tags: ['Bookings'],
      summary: "Scan a ticket's QR code at the event entrance (organizer only)",
      ...auth,
      ...body('BookingScanQr'),
      responses: { 200: ok('Ticket checked in.'), 400: err('Invalid, already-used, or unauthorized QR token.'), 401: unauthorized() },
    },
  },
  '/my-tickets': {
    get: {
      tags: ['Bookings'],
      summary: "List the caller's ticket bookings",
      ...auth,
      parameters: query('BookingGetUserTickets'),
      responses: { 200: okList('Tickets fetched.'), 401: unauthorized() },
    },
  },
  '/booking-detail': {
    get: {
      tags: ['Bookings'],
      summary: 'Get full detail for one booking',
      ...auth,
      parameters: query('BookingGetBookingDetail'),
      responses: { 200: ok('Booking fetched.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/get-tickets-by-events': {
    post: {
      tags: ['Bookings'],
      summary: "List an event's ticket bookings (organizer only)",
      ...auth,
      ...body('BookingGetTicketsByEvent'),
      responses: { 200: okList('Bookings fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
};
