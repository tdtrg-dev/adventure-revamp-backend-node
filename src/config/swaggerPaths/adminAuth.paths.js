const { ok, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/admin/admin-login': {
    post: {
      tags: ['Admin'],
      summary: 'Admin login (shares the same JWT guard as regular users — no role enforcement)',
      ...body('AdminLogin'),
      responses: { 200: ok('Logged in successfully.'), 400: err('Invalid credentials.') },
    },
  },
  '/admin/logout': {
    post: {
      tags: ['Admin'],
      summary: 'Admin logout — revokes the current JWT',
      ...auth,
      responses: { 200: ok('Logged out successfully.'), 401: unauthorized() },
    },
  },
  '/admin/me': {
    get: {
      tags: ['Admin'],
      summary: 'Get the authenticated admin (or user) profile',
      ...auth,
      responses: { 200: ok('Admin profile fetched successfully.'), 401: unauthorized() },
    },
  },
};
