const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/notification.controller');

router.get('/notifications', authenticate, controller.index);
router.get('/notifications/unread-count', authenticate, controller.unreadCount);
router.post('/notifications/mark-all-read', authenticate, controller.markAllRead);
router.post('/notifications/:id/mark-read', authenticate, controller.markRead);
router.delete('/notifications/:id', authenticate, controller.destroy);
router.delete('/notifications', authenticate, controller.destroyAll);

// Public debug endpoint (matches Laravel's un-authed /test-firebase/{userId})
router.get('/test-firebase/:userId', controller.testFirebase);

module.exports = router;
