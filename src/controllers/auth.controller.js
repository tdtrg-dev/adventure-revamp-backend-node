const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const authService = require('../services/auth.service');

const signup = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.signup(req.body);
  return success(res, { user, accessToken }, 'Data saved successfully');
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.login(req.body.email, req.body.password);
  return success(res, { user, accessToken }, 'Logged in successfully');
});

const socialLogin = asyncHandler(async (req, res) => {
  const { provider, access_token, user_type } = req.body;
  const { user, accessToken } = await authService.socialLogin(provider, access_token, user_type);
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  return success(res, { user, accessToken }, `Logged in successfully via ${label}`);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.auth.jti, req.user);
  return success(res, [], 'Logged out successfully');
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { id, hash } = req.params;
  const { expires } = req.query;
  const { alreadyVerified } = await authService.verifyEmail(id, hash, expires);
  return success(res, [], alreadyVerified ? 'Email already verified' : 'Email verified successfully');
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { alreadyVerified } = await authService.resendVerificationEmail(req.body.user_id, req.headers.origin);
  return success(res, [], alreadyVerified ? 'Email is already verified' : 'Verification email sent successfully');
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return success(res, [], 'Password reset link sent to your email.');
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.email, req.body.token, req.body.password);
  return success(res, [], 'Password reset successfully. Please login.');
});

module.exports = {
  signup,
  login,
  socialLogin,
  logout,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
