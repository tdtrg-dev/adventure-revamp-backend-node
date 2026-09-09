const Joi = require('joi');

const newsletter = Joi.object({
  email: Joi.string().email().max(255).required(),
  source: Joi.string().max(255).allow(null, ''),
});

const contact = Joi.object({
  first_name: Joi.string().max(255).required(),
  last_name: Joi.string().max(255).required(),
  email: Joi.string().email().max(255).required(),
  phone: Joi.string().max(50).allow(null, ''),
  message: Joi.string().max(2000).required(),
});

const parkStayLead = Joi.object({
  type: Joi.string().valid('host', 'guest').required().messages({
    'any.required': 'The type field is required and must be either host or guest.',
    'any.only': 'The type field must be either host or guest.',
  }),
  name: Joi.string().max(150).required(),
  email: Joi.string().email().max(150).required(),
  phone: Joi.string().max(30).allow(null, ''),
  description: Joi.string().max(2000).allow(null, ''),
});

module.exports = { newsletter, contact, parkStayLead };
