const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/subscription.validators');
const controller = require('../controllers/subscription.controller');

router.get('/get-payment-plans', authenticate, controller.getPaymentPlans);
router.post('/user-checkout', authenticate, validate(v.checkout), controller.checkout);
router.get('/get-current-subscription', authenticate, controller.getCurrentSubscription);

module.exports = router;
