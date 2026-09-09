const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/connection.validators');
const controller = require('../controllers/connection.controller');

router.post('/send-connection-request', authenticate, validate(v.sendRequest), controller.sendRequest);
router.post('/cancel-connection-request', authenticate, validate(v.cancelRequest), controller.cancelRequest);
router.post('/update-connection-status', authenticate, validate(v.updateRequestStatus), controller.updateRequestStatus);
router.post('/my-connections', authenticate, validate(v.getConnections), controller.getConnections);
router.get('/pending-requests', authenticate, controller.getPendingRequests);

router.post('/block-user', authenticate, validate(v.blockedIdOnly), controller.blockUser);
router.post('/unblock-user', authenticate, validate(v.blockedIdOnly), controller.unblockUser);
router.get('/blocked-users', authenticate, controller.getBlockedUsers);
router.post('/unfriend', authenticate, validate(v.unfriend), controller.unfriend);

module.exports = router;
