const Joi = require('joi');

// Matches a Mongo ObjectId (24 hex chars) — used wherever Laravel validated `integer|exists:table,id`.
const objectId = () => Joi.string().hex().length(24);

module.exports = { objectId };
