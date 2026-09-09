const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const eventService = require('../services/event.service');
const Event = require('../models/Event');

const createOrUpdateEvent = asyncHandler(async (req, res) => {
  const id = req.body.id || null;

  if (id) {
    const existing = await Event.findById(id);
    if (!existing) return error(res, 'Event not found', 400, []);
    if (String(existing.organizer_id) !== String(req.body.organizer_id)) {
      return error(res, 'You are not authorized to update this event', 403, []);
    }
  }

  const catIds = req.body.ticket_cat_id || [];
  const prices = req.body.ticket_price || [];
  const quantities = req.body.ticket_quantity || [];
  if (catIds.length !== prices.length || catIds.length !== quantities.length) {
    return error(res, 'ticket_cat_id, ticket_price and ticket_quantity must have equal number of items', 400, []);
  }
  if (req.body.event_date && req.body.event_description && req.body.event_date.length !== req.body.event_description.length) {
    return error(res, 'event_date and event_description must have equal number of items', 400, []);
  }

  const { event, message } = await eventService.createOrUpdateEvent(req.body, id, req.files);
  return success(res, event, message);
});

const cancelEvent = asyncHandler(async (req, res) => {
  const data = await eventService.cancelEvent(req.body.event_id, req.body.organizer_id);
  return success(res, data, 'Event cancelled successfully. Attendees will be notified via email.');
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.body.event_id);
  if (!event) return error(res, 'Event not found', 400, []);
  if (String(event.organizer_id) !== String(req.body.organizer_id)) {
    return error(res, 'You are not authorized to delete this event', 403, []);
  }
  await eventService.deleteEvent(req.body.event_id);
  return success(res, [], 'Event deleted successfully');
});

const changeStatus = asyncHandler(async (req, res) => {
  const data = await eventService.changeStatus(req.body.event_id, req.body.status);
  return success(res, data, `Event status changed to ${req.body.status} successfully`);
});

const findEventById = asyncHandler(async (req, res) => {
  const data = await eventService.findEventById(req.query.event_id);
  await eventService.trackVisit(req.query.event_id, req.user.id, req.ip, req.headers['user-agent']);
  return success(res, data, 'Event found');
});

const trackVisit = asyncHandler(async (req, res) => {
  const data = await eventService.trackVisit(req.body.event_id, req.body.user_id, req.ip, req.headers['user-agent']);
  return success(res, data, 'Visit tracked.');
});

const saveReview = asyncHandler(async (req, res) => {
  const { _message, ...data } = await eventService.saveReview(req.body.event_id, req.body.user_id, req.body.rating, req.body.review);
  return success(res, data, _message);
});

const getHomeEvents = asyncHandler(async (req, res) => {
  const data = await eventService.getHomeEvents(req.body.user_id, Number(req.body.currentLat), Number(req.body.currentLang));
  return success(res, data, 'Home events fetched successfully.');
});

const getEventPrices = asyncHandler(async (req, res) => {
  const data = await eventService.getEventPrices(req.query.event_id);
  return success(res, data, 'Event prices fetched successfully.');
});

const toggleFavourite = asyncHandler(async (req, res) => {
  const { _message, ...data } = await eventService.toggleFavourite(req.body.user_id, req.body.event_id);
  return success(res, data, _message);
});

const getUserFavourites = asyncHandler(async (req, res) => {
  const result = await eventService.getUserFavourites(req.query.user_id, Number(req.query.page) || 1);
  return success(res, result, 'Favourites fetched successfully.');
});

const getMyEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getOrganizerEvents(req.query.organizer_id || null, Number(req.query.page) || 1);
  return success(res, result, 'Organizer events fetched successfully.');
});

const getEventsByLocation = asyncHandler(async (req, res) => {
  const { _message, ...result } = await eventService.getEventsByLocation(
    req.body.user_id,
    Number(req.body.currentLat),
    Number(req.body.currentLang),
    Number(req.body.page) || 1
  );
  return success(res, result, _message);
});

const getEventsByRoute = asyncHandler(async (req, res) => {
  const { _message, ...result } = await eventService.getEventsByRoute(
    req.body.user_id,
    Number(req.body.start_lat),
    Number(req.body.start_lng),
    Number(req.body.end_lat),
    Number(req.body.end_lng),
    req.body.waypoints || [],
    Number(req.body.page) || 1
  );
  return success(res, result, _message);
});

const getAttendedEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getAttendedEvents(req.query.user_id, Number(req.query.page) || 1);
  return success(res, result, 'Attended events fetched successfully.');
});

const getEventReviews = asyncHandler(async (req, res) => {
  const result = await eventService.getEventReviews(req.query.event_id, Number(req.query.page) || 1);
  return success(res, result, 'Reviews fetched successfully.');
});

const getAllTicketCategories = asyncHandler(async (req, res) => {
  const data = await eventService.getAllTicketCategories(req.query.ticket_category_id);
  return success(res, data, data.length === 1 && req.query.ticket_category_id ? 'Ticket Category fetched successfully.' : 'Ticket Categories fetched successfully.');
});

module.exports = {
  getAllTicketCategories,
  createOrUpdateEvent,
  cancelEvent,
  deleteEvent,
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
