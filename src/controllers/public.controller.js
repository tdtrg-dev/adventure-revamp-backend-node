const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const publicService = require('../services/public.service');

function searchParams(req) {
  return req.method === 'GET' ? req.query : req.body;
}

const globalSearch = asyncHandler(async (req, res) => {
  const params = searchParams(req);
  const { data, message } = await publicService.globalSearch(params);
  return success(res, data, message);
});

const dashboardData = asyncHandler(async (req, res) => {
  const params = searchParams(req);
  const data = await publicService.getLandingDashboard(params);
  return success(res, data, 'Dashboard fetched successfully.');
});

const eventDetail = asyncHandler(async (req, res) => {
  const data = await publicService.getEventDetail(req.query.event_id, Number(req.query.related_limit) || 8);
  return success(res, data, 'Event found');
});

const categories = asyncHandler(async (req, res) => {
  const data = await publicService.getCategories();
  return success(res, data, 'Categories fetched successfully.');
});

module.exports = { globalSearch, dashboardData, eventDetail, categories };
