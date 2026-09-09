const { ok, unauthorized, auth, pathParam } = require('./_helpers');

module.exports = {
  '/notifications': {
    get: {
      tags: ['Notifications'],
      summary: "List the caller's notifications",
      ...auth,
      parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
      responses: { 200: ok('Notifications fetched.'), 401: unauthorized() },
    },
    delete: {
      tags: ['Notifications'],
      summary: 'Delete all notifications for the caller',
      ...auth,
      responses: { 200: ok('Notifications deleted.'), 401: unauthorized() },
    },
  },
  '/notifications/unread-count': {
    get: {
      tags: ['Notifications'],
      summary: 'Get the unread notification count',
      ...auth,
      responses: { 200: ok('Count fetched.'), 401: unauthorized() },
    },
  },
  '/notifications/mark-all-read': {
    post: {
      tags: ['Notifications'],
      summary: 'Mark every notification as read',
      ...auth,
      responses: { 200: ok('Marked read.'), 401: unauthorized() },
    },
  },
  '/notifications/{id}/mark-read': {
    post: {
      tags: ['Notifications'],
      summary: 'Mark one notification as read',
      ...auth,
      parameters: [pathParam('id', 'Notification id.')],
      responses: { 200: ok('Marked read.'), 400: { description: 'Not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }, 401: unauthorized() },
    },
  },
  '/notifications/{id}': {
    delete: {
      tags: ['Notifications'],
      summary: 'Delete one notification',
      ...auth,
      parameters: [pathParam('id', 'Notification id.')],
      responses: { 200: ok('Notification deleted.'), 401: unauthorized() },
    },
  },
  '/test-firebase/{userId}': {
    get: {
      tags: ['Notifications'],
      summary: 'Send a test Firebase push to a user (debug endpoint, unauthenticated)',
      parameters: [pathParam('userId', 'User id to push to.')],
      responses: { 200: ok('Push attempted.') },
    },
  },
};
