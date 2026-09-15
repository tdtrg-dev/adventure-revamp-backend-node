const Conversation = require('../models/Conversation');

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const PRIVATE_PREFIX = 'private-';

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
    // A malformed id would make Mongoose throw a CastError (a 500). It cannot name
    // a conversation the user belongs to, so it is simply a denial.
    authorize: async (user, { conversationId }) =>
      OBJECT_ID.test(conversationId) && Conversation.exists({ _id: conversationId, 'participants.user_id': user.id }),
  },
];

/**
 * Only private channels are registered, so only 'private-' names are signed. A
 * presence- subscription would also need channel_data in the signature (Pusher
 * rejects it without), a private-encrypted- one needs a master key this app does
 * not configure, and a public name needs no authorization at all. Returns the
 * name with the prefix stripped, or null when it is not a private channel.
 */
function privateChannelName(channelName) {
  return channelName.startsWith(PRIVATE_PREFIX) ? channelName.slice(PRIVATE_PREFIX.length) : null;
}

/**
 * Returns true/false for whether `user` may subscribe to `channelName`, mirroring
 * Broadcast::auth()'s pattern-match-then-callback flow. An unregistered channel
 * name is authorization-denied, same as Laravel (not a 404 — the whole point of
 * this endpoint is "may this user see this channel", not "does this channel exist").
 */
async function isAuthorized(user, channelName) {
  const normalized = privateChannelName(channelName);
  if (normalized === null) return false;

  for (const { pattern, authorize } of CHANNELS) {
    const match = normalized.match(pattern);
    if (match) return !!(await authorize(user, match.groups));
  }

  return false;
}

module.exports = { isAuthorized };
