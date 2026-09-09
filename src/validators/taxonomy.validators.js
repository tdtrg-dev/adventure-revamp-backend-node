const Joi = require('joi');
const { objectId } = require('./common');

const getAllInterest = Joi.object({
  interest_id: objectId().allow(null, ''),
});

const taxRatesIndex = Joi.object({
  applicable_to: Joi.string().valid('subscription', 'ticket', 'both'),
  country_code: Joi.string().max(5),
});

module.exports = { getAllInterest, taxRatesIndex };
