const { ok, err, unauthorized, auth, body, pathParam } = require('./_helpers');

module.exports = {
  '/signup': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user or company account',
      ...body('AuthSignup'),
      responses: {
        200: ok('Account created — returns the user plus a JWT accessToken.'),
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
        400: err('Invalid credentials.'),
        403: err('Account is banned or temporarily suspended.'),
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
  '/resend-verification-email': {
    post: {
      tags: ['Auth'],
      summary: 'Resend the email-verification link',
      ...body('AuthResendVerificationEmail'),
      responses: {
        200: ok('Verification email sent.'),
        400: err('User not found or already verified.'),
      },
    },
  },
  '/email/verify/{id}/{hash}': {
    get: {
      tags: ['Auth'],
      summary: 'Verify an email address via the emailed link',
      parameters: [pathParam('id', "The user's id."), pathParam('hash', 'SHA-1 hash of the verified email address.')],
      responses: { 200: ok('Email verified.'), 400: err('Invalid or expired verification link.') },
    },
    post: {
      tags: ['Auth'],
      summary: 'Verify an email address via the emailed link (POST form)',
      parameters: [pathParam('id', "The user's id."), pathParam('hash', 'SHA-1 hash of the verified email address.')],
      responses: { 200: ok('Email verified.'), 400: err('Invalid or expired verification link.') },
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
