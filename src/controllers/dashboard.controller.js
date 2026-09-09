const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const dashboardService = require('../services/dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard(req.body.user_id, {
    bookedPage: Number(req.body.booked_page) || 1,
    hostedPage: Number(req.body.hosted_page) || 1,
  });
  return success(res, data, 'Dashboard fetched successfully.');
});

module.exports = { getDashboard };
