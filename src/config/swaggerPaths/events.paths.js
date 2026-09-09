const { ok, okList, err, unauthorized, auth, body, query } = require('./_helpers');

module.exports = {
  '/get-all-ticket-categories': {
    get: {
      tags: ['Events'],
      summary: 'List ticket categories for an event',
      ...auth,
      parameters: query('EventGetAllTicketCategories'),
      responses: { 200: okList('Ticket categories fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/create-event': {
    post: {
      tags: ['Events'],
      summary: 'Create or update an event (multipart — thumbnail + event_images optional)',
      ...auth,
      ...body('EventCreateOrUpdateEvent'),
      responses: { 200: ok('Event saved.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/cancel-event': {
    post: {
      tags: ['Events'],
      summary: 'Cancel an event and its confirmed bookings',
      ...auth,
      ...body('EventCancelOrDeleteEvent'),
      responses: { 200: ok('Event cancelled.'), 400: err('Not found or not authorized.'), 401: unauthorized() },
    },
  },
  '/delete-event': {
    post: {
      tags: ['Events'],
      summary: 'Delete an event',
      ...auth,
      ...body('EventCancelOrDeleteEvent'),
      responses: { 200: ok('Event deleted.'), 400: err('Not found or not authorized.'), 401: unauthorized() },
    },
  },
  '/update-event-status': {
    post: {
      tags: ['Events'],
      summary: "Change an event's status (publish/pending/cancel/draft)",
      ...auth,
      ...body('EventChangeStatus'),
      responses: { 200: ok('Status updated.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/find-event': {
    get: {
      tags: ['Events'],
      summary: 'Get full event detail (authenticated — records a visit)',
      ...auth,
      parameters: query('EventFindEventById'),
      responses: { 200: ok('Event found.'), 400: err('Validation failed or not found.'), 401: unauthorized() },
    },
  },
  '/track-event-visit': {
    post: {
      tags: ['Events'],
      summary: 'Record an event-page visit',
      ...auth,
      ...body('EventTrackVisit'),
      responses: { 200: ok('Visit recorded.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/save-event-review': {
    post: {
      tags: ['Events'],
      summary: 'Submit a rating/review for an attended event',
      ...auth,
      ...body('EventSaveReview'),
      responses: { 200: ok('Review saved.'), 400: err('Validation failed or not eligible to review.'), 401: unauthorized() },
    },
  },
  '/get-event-reviews': {
    get: {
      tags: ['Events'],
      summary: 'List approved reviews for an event',
      ...auth,
      parameters: query('EventGetEventReviews'),
      responses: { 200: okList('Reviews fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-home-events': {
    post: {
      tags: ['Events'],
      summary: 'Personalized home feed (upcoming / for_you / top_rated / most_visited)',
      ...auth,
      ...body('EventGetHomeEvents'),
      responses: { 200: ok('Home events fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-event-prices': {
    get: {
      tags: ['Events'],
      summary: 'List ticket price tiers for an event',
      ...auth,
      parameters: query('EventGetEventPrices'),
      responses: { 200: okList('Prices fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/toggle-favourite': {
    post: {
      tags: ['Events'],
      summary: 'Favourite/unfavourite an event',
      ...auth,
      ...body('EventToggleFavourite'),
      responses: { 200: ok('Favourite toggled.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/my-favourites': {
    get: {
      tags: ['Events'],
      summary: "List the caller's favourited events",
      ...auth,
      parameters: query('EventGetUserFavourites'),
      responses: { 200: okList('Favourites fetched.'), 401: unauthorized() },
    },
  },
  '/my-events': {
    get: {
      tags: ['Events'],
      summary: 'List events the caller organizes',
      ...auth,
      parameters: query('EventGetMyEvents'),
      responses: { 200: okList('Events fetched.'), 401: unauthorized() },
    },
  },
  '/get-events-by-location': {
    post: {
      tags: ['Events'],
      summary: 'Radius search around a lat/lng (2dsphere $geoNear)',
      ...auth,
      ...body('EventGetEventsByLocation'),
      responses: { 200: okList('Events fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-events-by-route': {
    post: {
      tags: ['Events'],
      summary: 'Search events near a multi-point travel route',
      ...auth,
      ...body('EventGetEventsByRoute'),
      responses: { 200: okList('Events fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/attended-events': {
    get: {
      tags: ['Events'],
      summary: 'List events the caller has attended (confirmed/used ticket)',
      ...auth,
      parameters: query('EventGetAttendedEvents'),
      responses: { 200: okList('Events fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
};
