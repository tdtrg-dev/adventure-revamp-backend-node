const { ok, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user or company account',
      description:
        'A new account is created unverified and a 6-digit code is emailed to it. No accessToken is returned: `data` carries `email_verification_required: true` and `otp_sent`, and the app should move to the OTP screen and call /verify-email-otp. Calling with an existing `id` (profile completion) returns an accessToken only when that account is already verified.',
      ...body('AuthSignup'),
      responses: {
        200: ok('Account saved — verification code sent, or accessToken returned for an already-verified account.'),
        400: err('Validation failed, or the email is already registered.'),
      },
    },
  },
  '/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in with email + password',
      ...body('AuthLogin'),
      responses: {
        200: ok('Logged in — returns the user plus a JWT accessToken.'),
        400: err('Email not registered (`data.email`), incorrect password (`data.password`), or invalid input.'),
        403: err(
          'Account banned or suspended (`data.suspended_until`), or email not verified: `data.email_verified` is false, a fresh code has been emailed (`data.otp_sent`), and `data.retry_after_seconds` is set when one was sent too recently to resend.'
        ),
      },
    },
  },
  '/social-login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in or register via Google/Facebook',
      ...body('AuthSocialLogin'),
      responses: {
        200: ok('Logged in — returns the user plus a JWT accessToken.'),
        400: err('Invalid or expired provider token.'),
      },
    },
  },
  '/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request a password-reset email',
      ...body('AuthForgotPassword'),
      responses: {
        200: ok('Reset link sent (if the email exists).'),
        400: err('Unable to send the reset link.'),
      },
    },
  },
  '/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Reset a password using an emailed token',
      ...body('AuthResetPassword'),
      responses: {
        200: ok('Password updated.'),
        400: err('Invalid or expired token.'),
      },
    },
  },
  '/verify-email-otp': {
    post: {
      tags: ['Auth'],
      summary: 'Verify an email address with the emailed 6-digit code',
      description:
        'Codes expire after 10 minutes and allow 5 attempts; requesting a new code invalidates the previous one. On success the account is verified and its first accessToken is returned.',
      ...body('AuthVerifyEmailOtp'),
      responses: {
        200: ok('Email verified — returns the user plus a JWT accessToken.'),
        400: err('Email not registered or already verified (`data.email`), or the code is incorrect, expired, or no longer active (`data.otp`).'),
        403: err('Email verified, but the account is banned or suspended.'),
        429: err('Too many incorrect attempts — request a new code.'),
      },
    },
  },
  '/resend-email-otp': {
    post: {
      tags: ['Auth'],
      summary: 'Email a new verification code',
      description: 'Replaces any earlier code. Limited to one request per 60 seconds per account.',
      ...body('AuthResendEmailOtp'),
      responses: {
        200: ok('New code sent — `data` has `expires_in_seconds` and `resend_available_in_seconds`.'),
        400: err('Email not registered or already verified (`data.email`).'),
        429: err('Requested too soon — `data.retry_after_seconds` says how long to wait.'),
        503: err('The email could not be sent; try again.'),
      },
    },
  },
  '/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Revoke the current JWT',
      ...auth,
      responses: { 200: ok('Logged out.'), 401: unauthorized() },
    },
  },
};
