const Joi = require('joi');
const { objectId } = require('./common');

const saveUserBio = Joi.object({
  user_id: objectId().required(),
  bio_description: Joi.string().max(1000).required(),
}).unknown(true);

const saveRadius = Joi.object({
  user_id: objectId().required(),
  radius: Joi.number().integer().required(),
});

const saveUserInterest = Joi.object({
  user_id: objectId().required(),
  interest_id: Joi.array().items(objectId().required()).min(1).required(),
});

const getOnboardingStatus = Joi.object({
  user_id: objectId().required(),
});

module.exports = { saveUserBio, saveRadius, saveUserInterest, getOnboardingStatus };
