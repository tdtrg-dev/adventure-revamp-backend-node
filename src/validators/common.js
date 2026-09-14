const Joi = require('joi');

// Matches a Mongo ObjectId (24 hex chars) — used wherever Laravel validated `integer|exists:table,id`.
const objectId = () => Joi.string().hex().length(24);

// The default Joi messages surface verbatim as the API message (for example
// "email" must be a valid email, quotes included), so credential fields set their own.
const emailField = () =>
  Joi.string().email().max(255).required().messages({
    'string.base': 'Please enter a valid email address.',
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
    'string.max': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  });

const passwordField = () =>
  Joi.string().required().messages({
    'string.base': 'Password is required.',
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
  });

// Kept a string so leading zeros survive; the length matches OTP_LENGTH in
// services/auth.service.js.
const otpCode = () =>
  Joi.string()
    .trim()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      'string.base': 'Please enter the 6-digit verification code.',
      'string.empty': 'Verification code is required.',
      'string.pattern.base': 'Please enter the 6-digit verification code.',
      'any.required': 'Verification code is required.',
    });

module.exports = { objectId, emailField, passwordField, otpCode };
