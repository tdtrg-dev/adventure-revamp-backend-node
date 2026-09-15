const json = (ref) => ({ content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });

module.exports = {
  '/broadcasting/auth': {
    post: {
      tags: ['Broadcasting'],
      summary: 'Authorize a private Pusher channel subscription',
      description:
        'Called by the Pusher/Echo client (not by app code directly) before subscribing to a private channel — ' +
        '`private-user.{id}` (own id only) or `private-conversation.{id}` (must be a participant); user tokens only. Framework-native ' +
        'route, not part of this app\'s usual envelope: see PusherAuthResponse/RawMessage.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['channel_name', 'socket_id'],
              properties: {
                channel_name: { type: 'string', example: 'private-conversation.64f1a2b3c4d5e6f7a8b9c0d1' },
                socket_id: { type: 'string', example: '1234.5678' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Authorized — Pusher auth signature.', ...json('PusherAuthResponse') },
        400: { description: 'channel_name or socket_id missing, or socket_id malformed.', ...json('RawMessage') },
        401: { description: 'Missing or invalid token.', ...json('RawMessage') },
        403: { description: 'Not authorized for this channel — including any name without the private- prefix, and admin tokens.', ...json('RawMessage') },
      },
    },
  },
};
