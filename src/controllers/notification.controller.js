const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const notificationListService = require('../services/notificationList.service');
const { sendToUserTopic } = require('../integrations/firebase');

const index = asyncHandler(async (req, res) => {
  const result = await notificationListService.list(req.user.id, Number(req.query.page) || 1);
  return success(res, result, 'Notifications retrieved.');
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationListService.unreadCount(req.user.id);
  return success(res, { unread_count: count }, 'Unread count retrieved.');
});

const markRead = asyncHandler(async (req, res) => {
  await notificationListService.markRead(req.user.id, req.params.id);
  return success(res, [], 'Notification marked as read.');
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationListService.markAllRead(req.user.id);
  return success(res, [], 'All notifications marked as read.');
});

const destroy = asyncHandler(async (req, res) => {
  await notificationListService.destroy(req.user.id, req.params.id);
  return success(res, [], 'Notification deleted.');
});

const destroyAll = asyncHandler(async (req, res) => {
  await notificationListService.destroyAll(req.user.id);
  return success(res, [], 'All notifications cleared.');
});

// Debug endpoint (public in Laravel too) — pushes the recipient's latest notification via FCM.
const testFirebase = asyncHandler(async (req, res) => {
  const notifications = await notificationListService.getMyNotifications(req.params.userId);
  const latest = notifications[0];
  if (!latest) return success(res, [], 'Notify content not available');

  await sendToUserTopic(req.params.userId, { title: latest.title, body: latest.body, data: { navigateTo: latest.type } });
  return success(res, [], 'Firebase notification sent.');
});

module.exports = { index, unreadCount, markRead, markAllRead, destroy, destroyAll, testFirebase };
