const Joi = require('joi');
const { objectId } = require('./common');

const getDashboard = Joi.object({
  user_id: objectId().required(),
  booked_page: Joi.number().integer().min(1),
  hosted_page: Joi.number().integer().min(1),
});

module.exports = { getDashboard };
