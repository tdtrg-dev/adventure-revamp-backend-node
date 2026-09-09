const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const websiteService = require('../services/website.service');

const subscribeNewsletter = asyncHandler(async (req, res) => {
  try {
    const message = await websiteService.subscribeNewsletter(req.body);
    return success(res, [], message);
  } catch (e) {
    return error(res, 'Unable to subscribe right now. Please try again later.', 500, null);
  }
});

const contact = asyncHandler(async (req, res) => {
  try {
    const data = await websiteService.contact(req.body);
    return success(res, data, 'We have received your query. We will get back to you soon.');
  } catch (e) {
    return error(res, 'Failed to send your message. Please try again later.', 500, null);
  }
});

const parkStayLead = asyncHandler(async (req, res) => {
  try {
    const { message, data } = await websiteService.parkStayLead(req.body);
    return success(res, data, message);
  } catch (e) {
    return error(res, 'Unable to join the waitlist right now. Please try again later.', 500, null);
  }
});

module.exports = { subscribeNewsletter, contact, parkStayLead };
