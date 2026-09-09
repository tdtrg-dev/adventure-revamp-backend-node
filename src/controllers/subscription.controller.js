const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const subscriptionService = require('../services/subscription.service');

const getPaymentPlans = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getPaymentPlanWithServices();
  return success(res, data, 'Price Plan');
});

const checkout = asyncHandler(async (req, res) => {
  const { _message, ...data } = await subscriptionService.checkout(req.body);
  return success(res, data, _message, 201);
});

const getCurrentSubscription = asyncHandler(async (req, res) => {
  if (!req.user) return error(res, 'Unauthorized', 401, []);
  const data = await subscriptionService.getCurrentSubscription(req.user.id);
  return success(res, data, data ? 'Current subscription plan fetched successfully' : 'No active subscription found');
});

module.exports = { getPaymentPlans, checkout, getCurrentSubscription };
