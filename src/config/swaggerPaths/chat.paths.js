const { ok, okList, err, unauthorized, auth, body, query } = require('./_helpers');

module.exports = {
  '/conversations': {
    get: {
      tags: ['Chat'],
      summary: 'List the conversation inbox',
      ...auth,
      responses: { 200: okList('Conversations fetched.'), 401: unauthorized() },
    },
  },
  '/messages': {
    get: {
      tags: ['Chat'],
      summary: 'List messages in a conversation',
      ...auth,
      parameters: query('ChatConversationIdQuery'),
      responses: { 200: ok('Messages fetched.'), 400: err('Not a participant.'), 401: unauthorized() },
    },
  },
  '/send-message': {
    post: {
      tags: ['Chat'],
      summary: 'Send a message',
      ...auth,
      ...body('ChatSendMessage'),
      responses: { 200: ok('Message sent.'), 400: err('Not a participant, or blocked.'), 401: unauthorized() },
    },
  },
  '/typing': {
    post: {
      tags: ['Chat'],
      summary: 'Broadcast a typing indicator',
      ...auth,
      ...body('ChatTyping'),
      responses: { 200: ok('Broadcast sent.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/mark-delivered': {
    post: {
      tags: ['Chat'],
      summary: 'Mark the other participant’s unread messages as delivered',
      ...auth,
      ...body('ChatConversationIdOnly'),
      responses: { 200: ok('Marked delivered.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/mark-read': {
    post: {
      tags: ['Chat'],
      summary: 'Mark a conversation as read',
      ...auth,
      ...body('ChatConversationIdOnly'),
      responses: { 200: ok('Marked read.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/clear-chat': {
    post: {
      tags: ['Chat'],
      summary: 'Clear (hide) chat history up to now for the caller only',
      ...auth,
      ...body('ChatConversationIdOnly'),
      responses: { 200: ok('Chat cleared.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/chat/block': {
    post: {
      tags: ['Chat'],
      summary: 'Block a user from within a chat context',
      ...auth,
      ...body('ChatBlockUnblock'),
      responses: { 200: ok('User blocked.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/chat/unblock': {
    post: {
      tags: ['Chat'],
      summary: 'Unblock a user from within a chat context',
      ...auth,
      ...body('ChatBlockUnblock'),
      responses: { 200: ok('User unblocked.'), 400: err('No block record found.'), 401: unauthorized() },
    },
  },
  '/chat/blocked-users': {
    get: {
      tags: ['Chat'],
      summary: 'List blocked users (chat context)',
      ...auth,
      responses: { 200: okList('Blocked users fetched.'), 401: unauthorized() },
    },
  },
};
