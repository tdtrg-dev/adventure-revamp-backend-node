const Joi = require('joi');
const { objectId } = require('./common');

const checkout = Joi.object({
  user_id: objectId().required(),
  plan_id: objectId().required(),
  tid: Joi.string().required(),
  channel: Joi.string().valid('stripe', 'apple', 'google', 'free').required(),
  amount: Joi.number().min(0).required(),
});

module.exports = { checkout };
