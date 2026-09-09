const { ok, unauthorized, auth } = require('./_helpers');

module.exports = {
  '/presence/ping': {
    post: {
      tags: ['Presence'],
      summary: 'Mark the caller online (heartbeat)',
      ...auth,
      responses: { 200: ok('Marked online.'), 401: unauthorized() },
    },
  },
  '/presence/offline': {
    post: {
      tags: ['Presence'],
      summary: 'Mark the caller offline',
      ...auth,
      responses: { 200: ok('Marked offline.'), 401: unauthorized() },
    },
  },
};
