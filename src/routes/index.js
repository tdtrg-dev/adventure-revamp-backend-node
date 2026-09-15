const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use(require('./broadcasting.routes'));
router.use(require('./auth.routes'));
router.use(require('./users.routes'));
router.use(require('./onboarding.routes'));
router.use(require('./presence.routes'));
router.use(require('./taxonomy.routes'));
router.use(require('./events.routes'));
router.use(require('./bookings.routes'));
router.use(require('./subscriptions.routes'));
router.use(require('./notifications.routes'));
router.use(require('./dashboard.routes'));
router.use(require('./community.routes'));
router.use(require('./connections.routes'));
router.use(require('./chat.routes'));
router.use('/admin', require('./admin'));
router.use(require('./website.routes'));
router.use(require('./public.routes'));

module.exports = router;