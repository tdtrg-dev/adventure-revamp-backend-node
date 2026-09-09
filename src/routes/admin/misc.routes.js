const express = require('express');
const router = express.Router();

const { authenticate } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { success, error } = require('../../utils/response');
const v = require('../../validators/admin.validators');

const userService = require('../../services/user.service');
const eventService = require('../../services/event.service');
const ticketBookingService = require('../../services/ticketBooking.service');
const reviewService = require('../../services/review.service');
const parkStayLeadService = require('../../services/parkStayLead.service');
const postService = require('../../services/post.service');
const { objectId } = require('../../validators/common');
const Joi = require('joi');

router.use(authenticate);

// ── Users ────────────────────────────────────────────────────────────────────
router.get(
  '/get-all-users',
  asyncHandler(async (req, res) => {
    const data = await userService.getAllUsers(Number(req.query.page) || 1);
    return success(res, data, 'Users fetched successfully.');
  })
);

router.delete(
  '/delete-user/:id',
  asyncHandler(async (req, res) => {
    try {
      await userService.deleteUserProfile(req.params.id);
      return success(res, [], 'User deleted successfully');
    } catch (e) {
      const code = e.message === 'User not found' ? 404 : 400;
      return error(res, e.message, code, []);
    }
  })
);

// ── Events ───────────────────────────────────────────────────────────────────
router.get(
  '/get-all-events',
  asyncHandler(async (req, res) => {
    const data = await eventService.getOrganizerEvents(null, Number(req.query.page) || 1);
    return success(res, data, 'Organizer events fetched successfully.');
  })
);

// ── Ticket bookings ──────────────────────────────────────────────────────────
router.get(
  '/ticket-bookings',
  asyncHandler(async (req, res) => {
    const data = await ticketBookingService.getAllBookings(Number(req.query.page) || 1);
    return success(res, data, 'All bookings fetched successfully.');
  })
);
router.get(
  '/ticket-bookings-detail',
  asyncHandler(async (req, res) => {
    const data = await ticketBookingService.getBookingDetailForAdmin(req.query.booking_id);
    return success(res, data, 'Booking detail fetched successfully.');
  })
);

// ── Reviews ──────────────────────────────────────────────────────────────────
router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const data = await reviewService.getAllEventReviews(Number(req.query.page) || 1, Number(req.query.per_page) || 15);
    return success(res, data, 'Event reviews fetched successfully.');
  })
);
router.get(
  '/reviews/detail',
  validate(Joi.object({ event_id: objectId().required(), per_page: Joi.number().integer().min(1).max(100) }), 'query'),
  asyncHandler(async (req, res) => {
    try {
      const data = await reviewService.getEventReviewDetail(req.query.event_id, Number(req.query.page) || 1, Number(req.query.per_page) || 15);
      return success(res, data, 'Event review detail fetched successfully.');
    } catch (e) {
      return error(res, e.message, e.statusCode || 404, []);
    }
  })
);

// ── Park & Stay leads ────────────────────────────────────────────────────────
router.get(
  '/park-stay-leads',
  validate(v.parkStayLeadIndex, 'query'),
  asyncHandler(async (req, res) => {
    const data = await parkStayLeadService.index(req.query);
    return success(res, data, 'Park & Stay leads fetched successfully.');
  })
);
router.patch(
  '/park-stay-leads/:id/status',
  validate(v.parkStayLeadStatus),
  asyncHandler(async (req, res) => {
    const data = await parkStayLeadService.updateStatus(req.params.id, req.body.status);
    return success(res, data, 'Lead status updated successfully.');
  })
);

// ── Profile / event reports ──────────────────────────────────────────────────
router.get(
  '/get-profile-reports',
  asyncHandler(async (req, res) => {
    const data = await userService.getAllReportsForAdmin('profile');
    return success(res, data, 'All profile reports fetched successfully');
  })
);
router.get(
  '/get-event-reports',
  asyncHandler(async (req, res) => {
    const data = await userService.getAllReportsForAdmin('event');
    return success(res, data, 'All event reports fetched successfully');
  })
);
router.post(
  '/action-user-event-report',
  validate(v.actionUserEventReport),
  asyncHandler(async (req, res) => {
    const actor = req.admin || req.user;
    const data = await userService.actionReport(req.body.report_id, req.body.action, req.body.remarks, actor.id);
    return success(res, data, 'Report action taken successfully');
  })
);
router.delete(
  '/delete-user-event-report/:id',
  asyncHandler(async (req, res) => {
    await userService.deleteReport(req.params.id);
    return success(res, [], 'Report deleted successfully');
  })
);

// ── Community reports (reuses CommunityController's admin-facing methods) ────
router.get(
  '/get-community-reports',
  asyncHandler(async (req, res) => {
    const data = await postService.getAllReportedPostsForAdmin();
    return success(res, data, 'Reported posts fetched successfully');
  })
);
router.post(
  '/action-community-report',
  asyncHandler(async (req, res) => {
    const actor = req.admin || req.user;
    const data = await postService.actionReportedPost(actor.id, req.body.report_id, req.body.action, req.body.remarks);
    return success(res, data, 'Action taken successfully');
  })
);
router.delete(
  '/delete-community-report/:id',
  asyncHandler(async (req, res) => {
    await postService.deleteReport(req.params.id);
    return success(res, [], 'Report deleted successfully');
  })
);

module.exports = router;
