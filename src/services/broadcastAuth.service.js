const Conversation = require('../models/Conversation');

// Mirrors routes/channels.php exactly — 3 registered private channels, each a
// pattern with a `{placeholder}` plus an authorization callback taking the
// authenticated user and the captured id(s).
const CHANNELS = [
  {
    pattern: /^App\.Models\.User\.(?<id>[^.]+)$/,
    authorize: (user, { id }) => String(user.id) === String(id),
  },
  {
    pattern: /^user\.(?<id>[^.]+)$/,
    authorize: (user, { id }) => String(user.id) === String(id),
  },
  {
    pattern: /^conversation\.(?<conversationId>[^.]+)$/,
    authorize: async (user, { conversationId }) =>
      Conversation.exists({ _id: conversationId, 'participants.user_id': user.id }),
  },
];

/** Strips Pusher's private-/presence- prefix, same as Laravel's channel-name normalization. */
function normalizeChannelName(channelName) {
  return channelName.replace(/^(private|presence)-/, '');
}

/**
 * Returns true/false for whether `user` may subscribe to `channelName`, mirroring
 * Broadcast::auth()'s pattern-match-then-callback flow. An unregistered channel
 * name is authorization-denied, same as Laravel (not a 404 — the whole point of
 * this endpoint is "may this user see this channel", not "does this channel exist").
 */
async function isAuthorized(user, channelName) {
  const normalized = normalizeChannelName(channelName);

  for (const { pattern, authorize } of CHANNELS) {
    const match = normalized.match(pattern);
    if (match) return !!(await authorize(user, match.groups));
  }

  return false;
}

module.exports = { isAuthorized, normalizeChannelName };
