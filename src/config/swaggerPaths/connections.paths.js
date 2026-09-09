const { ok, okList, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/send-connection-request': {
    post: {
      tags: ['Connections'],
      summary: 'Send a friend request',
      ...auth,
      ...body('ConnectionSendRequest'),
      responses: { 200: ok('Request sent.'), 400: err('Validation failed or already connected.'), 401: unauthorized() },
    },
  },
  '/cancel-connection-request': {
    post: {
      tags: ['Connections'],
      summary: 'Cancel a sent friend request',
      ...auth,
      ...body('ConnectionCancelRequest'),
      responses: { 200: ok('Request cancelled.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/update-connection-status': {
    post: {
      tags: ['Connections'],
      summary: 'Accept or decline a received friend request',
      ...auth,
      ...body('ConnectionUpdateRequestStatus'),
      responses: { 200: ok('Status updated.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/my-connections': {
    post: {
      tags: ['Connections'],
      summary: 'List accepted friends',
      ...auth,
      ...body('ConnectionGetConnections'),
      responses: { 200: okList('Connections fetched.'), 401: unauthorized() },
    },
  },
  '/pending-requests': {
    get: {
      tags: ['Connections'],
      summary: 'List received friend requests awaiting a response',
      ...auth,
      responses: { 200: okList('Requests fetched.'), 401: unauthorized() },
    },
  },
  '/block-user': {
    post: {
      tags: ['Connections'],
      summary: 'Block a user (also removes any existing friendship)',
      ...auth,
      ...body('ConnectionBlockedIdOnly'),
      responses: { 200: ok('User blocked.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/unblock-user': {
    post: {
      tags: ['Connections'],
      summary: 'Unblock a user',
      ...auth,
      ...body('ConnectionBlockedIdOnly'),
      responses: { 200: ok('User unblocked.'), 400: err('No block record found.'), 401: unauthorized() },
    },
  },
  '/blocked-users': {
    get: {
      tags: ['Connections'],
      summary: 'List users the caller has blocked',
      ...auth,
      responses: { 200: okList('Blocked users fetched.'), 401: unauthorized() },
    },
  },
  '/unfriend': {
    post: {
      tags: ['Connections'],
      summary: 'Remove an existing friendship',
      ...auth,
      ...body('ConnectionUnfriend'),
      responses: { 200: ok('Unfriended.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
};
