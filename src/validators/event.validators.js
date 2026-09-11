const Joi = require('joi');
const { objectId } = require('./common');

const createOrUpdateEvent = Joi.object({
  id: objectId().allow(null, ''),
  trip_name: Joi.string().max(255).required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().min(Joi.ref('start_date')).required().messages({ 'date.min': 'end_date must be on or after start_date' }),
  organizer_id: objectId().required(),
  latitude: Joi.number().min(-90).max(90).allow(null, ''),
  longitude: Joi.number().min(-180).max(180).allow(null, ''),
  location_name: Joi.string().max(255).required(),
  description: Joi.string().required(),
  link: Joi.string().uri().max(500).allow(null, ''),
  gear_icons: Joi.array().items(Joi.string().max(100).allow(null, '')).allow(null),
  keep_image_ids: Joi.array().items(Joi.string()).allow(null),
  selectedInterest: Joi.array().items(objectId()).min(1).required().messages({ 'array.min': 'At least one interest is required' }),
  event_date: Joi.array().items(Joi.date().allow(null, '')).allow(null),
  event_description: Joi.array().items(Joi.string().allow(null, '')).allow(null),
  ticket_cat_id: Joi.array().items(objectId()).min(1).required().messages({ 'array.min': 'At least one ticket category is required' }),
  ticket_price: Joi.array().items(Joi.number().min(0)).min(1).required().messages({ 'array.min': 'Ticket prices are required' }),
  ticket_quantity: Joi.array().items(Joi.number().integer().min(0)).min(1).required().messages({ 'array.min': 'Ticket quantities are required' }),
}).unknown(true);

const cancelOrDeleteEvent = Joi.object({
  event_id: objectId().required(),
  organizer_id: objectId().required(),
});

const changeStatus = Joi.object({
  event_id: objectId().required(),
  status: Joi.string().valid('pending', 'publish', 'cancel').required(),
});

const findEventById = Joi.object({ event_id: objectId().required() });

const trackVisit = Joi.object({
  event_id: objectId().required(),
  user_id: objectId().required(),
});

const saveReview = Joi.object({
  event_id: objectId().required(),
  user_id: objectId().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  review: Joi.string().max(1000).allow(null, ''),
});

const getHomeEvents = Joi.object({
  user_id: objectId().required(),
  currentLat: Joi.number().min(-90).max(90).required(),
  currentLang: Joi.number().min(-180).max(180).required(),
});

const getEventPrices = Joi.object({ event_id: objectId().required() });

const toggleFavourite = Joi.object({
  user_id: objectId().required(),
  event_id: objectId().required(),
});

const getUserFavourites = Joi.object({
  user_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const getMyEvents = Joi.object({
  organizer_id: objectId().allow(null, ''),
  page: Joi.number().integer().min(1),
});

const getEventsByLocation = Joi.object({
  user_id: objectId().required(),
  currentLat: Joi.number().min(-90).max(90).required(),
  currentLang: Joi.number().min(-180).max(180).required(),
  // All three optional: radius falls back to the saved profile radius, and
  // omitting both dates keeps the original "upcoming events only" behaviour.
  radius: Joi.number().min(1).max(20000),
  start_date: Joi.date(),
  end_date: Joi.date().min(Joi.ref('start_date')).messages({ 'date.min': 'end_date must be on or after start_date' }),
  page: Joi.number().integer().min(1),
});

const getEventsByRoute = Joi.object({
  user_id: objectId().required(),
  start_lat: Joi.number().min(-90).max(90).required(),
  start_lng: Joi.number().min(-180).max(180).required(),
  end_lat: Joi.number().min(-90).max(90).required(),
  end_lng: Joi.number().min(-180).max(180).required(),
  waypoints: Joi.array()
    .max(50) // bounds the per-event segment scan in getEventsByRoute
    .items(
      Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required(),
      })
    ),
  // optional — falls back to the saved profile radius
  radius: Joi.number().min(1).max(20000),
  page: Joi.number().integer().min(1),
});

const getAttendedEvents = Joi.object({ user_id: objectId().required() });

const getEventReviews = Joi.object({
  event_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const getAllTicketCategories = Joi.object({
  ticket_category_id: objectId().allow(null, ''),
});

module.exports = {
  getAllTicketCategories,
  createOrUpdateEvent,
  cancelOrDeleteEvent,
  changeStatus,
  findEventById,
  trackVisit,
  saveReview,
  getHomeEvents,
  getEventPrices,
  toggleFavourite,
  getUserFavourites,
  getMyEvents,
  getEventsByLocation,
  getEventsByRoute,
  getAttendedEvents,
  getEventReviews,
};
