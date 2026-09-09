const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { uploader } = require('../middlewares/upload');
const v = require('../validators/event.validators');
const controller = require('../controllers/event.controller');

const eventImageUpload = uploader('events', 10).fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'event_images', maxCount: 20 },
]);

router.get('/get-all-ticket-categories', authenticate, validate(v.getAllTicketCategories, 'query'), controller.getAllTicketCategories);

router.post('/create-event', authenticate, eventImageUpload, validate(v.createOrUpdateEvent), controller.createOrUpdateEvent);
router.post('/cancel-event', authenticate, validate(v.cancelOrDeleteEvent), controller.cancelEvent);
router.post('/delete-event', authenticate, validate(v.cancelOrDeleteEvent), controller.deleteEvent);
router.post('/update-event-status', authenticate, validate(v.changeStatus), controller.changeStatus);
router.get('/find-event', authenticate, validate(v.findEventById, 'query'), controller.findEventById);
router.post('/track-event-visit', authenticate, validate(v.trackVisit), controller.trackVisit);
router.post('/save-event-review', authenticate, validate(v.saveReview), controller.saveReview);
router.get('/get-event-reviews', authenticate, validate(v.getEventReviews, 'query'), controller.getEventReviews);
router.post('/get-home-events', authenticate, validate(v.getHomeEvents), controller.getHomeEvents);
router.get('/get-event-prices', authenticate, validate(v.getEventPrices, 'query'), controller.getEventPrices);
router.post('/toggle-favourite', authenticate, validate(v.toggleFavourite), controller.toggleFavourite);
router.get('/my-favourites', authenticate, validate(v.getUserFavourites, 'query'), controller.getUserFavourites);
router.get('/my-events', authenticate, validate(v.getMyEvents, 'query'), controller.getMyEvents);
router.post('/get-events-by-location', authenticate, validate(v.getEventsByLocation), controller.getEventsByLocation);
router.post('/get-events-by-route', authenticate, validate(v.getEventsByRoute), controller.getEventsByRoute);
router.get('/attended-events', authenticate, validate(v.getAttendedEvents, 'query'), controller.getAttendedEvents);

module.exports = router;
