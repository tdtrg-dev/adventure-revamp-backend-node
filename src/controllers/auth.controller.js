const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const authService = require('../services/auth.service');

const signup = asyncHandler(async (req, res) => {
  const { user, accessToken, otp } = await authService.signup(req.body);
  if (accessToken) {
    return success(res, { user, accessToken }, 'Data saved successfully');
  }

  // Unverified accounts get no token — the app moves to the OTP screen instead.
  let message = 'Data saved successfully. Please verify your email to continue.';
  if (otp && otp.sent) message = "Account created. We've sent a verification code to your email.";
  else if (otp) message = "Account created, but we couldn't send the verification code. Please request a new one.";

  return success(res, { user, email_verification_required: true, otp_sent: Boolean(otp && otp.sent) }, message);
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

const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.verifyEmailOtp(req.body.email, req.body.otp);
  return success(res, { user, accessToken }, 'Email verified successfully.');
});

const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email, expiresInSeconds, resendAvailableInSeconds } = await authService.resendEmailOtp(req.body.email);
  return success(
    res,
    { email, expires_in_seconds: expiresInSeconds, resend_available_in_seconds: resendAvailableInSeconds },
    "We've sent a new verification code to your email."
  );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, expiresInSeconds, resendAvailableInSeconds } = await authService.forgotPassword(req.body.email);
  return success(
    res,
    { email, expires_in_seconds: expiresInSeconds, resend_available_in_seconds: resendAvailableInSeconds },
    "We've sent a password reset code to your email."
  );
});

const verifyResetOtp = asyncHandler(async (req, res) => {
  const { resetToken, expiresInSeconds } = await authService.verifyResetOtp(req.body.email, req.body.otp);
  return success(res, { reset_token: resetToken, expires_in_seconds: expiresInSeconds }, 'Code verified. You can now set a new password.');
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.email, { otp: req.body.otp, resetToken: req.body.reset_token }, req.body.password);
  return success(res, [], 'Password reset successfully. Please log in.');
});

module.exports = {
  signup,
  login,
  socialLogin,
  logout,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
