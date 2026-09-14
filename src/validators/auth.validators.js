const Joi = require('joi');
const { objectId, emailField, passwordField, otpCode } = require('./common');

const signup = Joi.object({
  id: objectId().allow(null, '', 0).optional(),
  user_type: Joi.string().valid('user', 'company').required(),
  name: Joi.string().max(255).required(),
  email: Joi.string().email().max(255).required(),
  gender: Joi.string()
    .valid('male', 'female', 'other')
    .when('user_type', { is: 'user', then: Joi.required() }),
  dob: Joi.date().when('user_type', { is: 'user', then: Joi.required() }),
  phone: Joi.string().max(20).allow(null, ''),
  bio: Joi.string().allow(null, ''),
  radius: Joi.number().integer().allow(null),
  password: Joi.string().min(8).when('id', { is: Joi.exist().valid(null, '', 0), then: Joi.required(), otherwise: Joi.optional() }),
  password_confirmation: Joi.string().valid(Joi.ref('password')).when('password', { is: Joi.exist(), then: Joi.required() }),
  google_id: Joi.string().allow(null, ''),
  current_lat: Joi.number().allow(null),
  current_long: Joi.number().allow(null),
  full_address: Joi.string().allow(null, ''),
}).unknown(true);

const login = Joi.object({
  email: emailField(),
  password: passwordField(),
  current_lat: Joi.number().allow(null),
  current_long: Joi.number().allow(null),
  full_address: Joi.string().allow(null, ''),
});

const socialLogin = Joi.object({
  provider: Joi.string().valid('google', 'facebook').required(),
  access_token: Joi.string().required(),
  user_type: Joi.string().valid('user', 'company').allow(null),
});

const verifyEmailOtp = Joi.object({
  email: emailField(),
  otp: otpCode(),
});

const resendEmailOtp = Joi.object({
  email: emailField(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  password_confirmation: Joi.string().valid(Joi.ref('password')).required(),
});

const getAllUsers = Joi.object({
  current_user_id: objectId().required(),
  page: Joi.number().integer().min(1).optional(),
});

const getUserProfile = Joi.object({
  user_id: objectId().required(),
});

const reportUserProfile = Joi.object({
  report_type: Joi.string().valid('profile', 'event').required(),
  report_link: Joi.string().uri().required(),
  reason: Joi.string().required(),
  message: Joi.string().allow(null, ''),
}).unknown(true);

const deleteUserProfile = Joi.object({
  user_id: objectId().required(),
});

const updateProfile = Joi.object({
  user_id: objectId().required(),
  name: Joi.string().max(255).required(),
  email: Joi.string().email().max(255), // accepted for backward compatibility, never applied — see updateUserCoreProfile
  user_type: Joi.string().valid('user', 'company').required(),
  phone: Joi.string().max(20).allow(null, ''),
  dob: Joi.date().allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'other').allow(null, ''),
  bio_description: Joi.string().max(1000).allow(null, ''),
  radius: Joi.number().integer().min(1).allow(null, ''),
  password: Joi.string().min(8).allow(null, ''),
  password_confirmation: Joi.string().valid(Joi.ref('password')).when('password', { is: Joi.string().min(1), then: Joi.required() }),
  interest_sub_cat: Joi.array().items(objectId()).allow(null),
}).unknown(true);

module.exports = {
  signup,
  login,
  socialLogin,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  resetPassword,
  getAllUsers,
  getUserProfile,
  reportUserProfile,
  deleteUserProfile,
  updateProfile,
};
