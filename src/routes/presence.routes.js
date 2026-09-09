const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/presence.controller');

// See onboarding.routes.js note: authenticate applied per-route, not via router.use(),
// since this router is mounted at bare '/' and would otherwise intercept every
// later-mounted route too.
router.post('/presence/ping', authenticate, controller.ping);
router.post('/presence/offline', authenticate, controller.goOffline);

module.exports = router;
