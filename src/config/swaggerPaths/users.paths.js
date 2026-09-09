const { ok, err, unauthorized, auth, body, query } = require('./_helpers');

module.exports = {
  '/get-user-profile': {
    get: {
      tags: ['Users'],
      summary: "Fetch a user's public profile",
      parameters: query('AuthGetUserProfile'),
      responses: { 200: ok('Profile fetched.'), 400: err('Validation failed or user not found.') },
    },
  },
  '/get-all-users': {
    post: {
      tags: ['Users'],
      summary: 'List other users (with connection status, mutual friends, badges)',
      ...auth,
      ...body('AuthGetAllUsers'),
      responses: { 200: ok('Users fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/update-profile': {
    post: {
      tags: ['Users'],
      summary: "Update the caller's profile (multipart — bio_image optional)",
      ...auth,
      ...body('AuthUpdateProfile'),
      responses: { 200: ok('Profile updated.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/delete-user-profile': {
    post: {
      tags: ['Users'],
      summary: 'Soft-delete a user account',
      ...auth,
      ...body('AuthDeleteUserProfile'),
      responses: { 200: ok('User deleted.'), 400: err('User not found.'), 401: unauthorized() },
    },
  },
  '/submit-report': {
    post: {
      tags: ['Users'],
      summary: 'Report a profile or event (multipart — attachment optional)',
      ...auth,
      ...body('AuthReportUserProfile'),
      responses: { 200: ok('Report submitted.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-my-reports': {
    get: {
      tags: ['Users'],
      summary: 'List reports the caller has filed',
      ...auth,
      responses: { 200: ok('Reports fetched.'), 401: unauthorized() },
    },
  },
};
