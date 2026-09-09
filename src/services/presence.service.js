const Conversation = require('../models/Conversation');
const pusher = require('../integrations/pusher');

const OFFLINE_TTL_MINUTES = 2;

async function broadcastToPartners(user, isOnline) {
  const lastSeenAt = isOnline ? null : user.last_seen_at ? user.last_seen_at.toISOString() : null;

  // 1-to-1 conversations this user participates in (group chats excluded — too noisy)
  const conversations = await Conversation.find({
    is_group: false,
    deleted_at: null,
    'participants.user_id': user._id,
  }).select('participants');

  const partnerIds = new Set();
  conversations.forEach((conv) => {
    conv.participants.forEach((p) => {
      if (String(p.user_id) !== String(user._id)) partnerIds.add(String(p.user_id));
    });
  });

  partnerIds.forEach((partnerId) => {
    pusher.trigger(`user.${partnerId}`, isOnline ? 'user_online' : 'user_offline', {
      user_id: user._id.toString(),
      is_online: isOnline,
      last_seen_at: lastSeenAt,
    });
  });
}

async function markOnline(user) {
  const wasOnline = !!user.is_online;
  user.last_seen_at = new Date();
  if (!wasOnline) user.is_online = true;
  await user.save();

  if (!wasOnline) await broadcastToPartners(user, true);
}

async function markOffline(user) {
  if (!user.is_online) return;
  user.is_online = false;
  user.last_seen_at = new Date();
  await user.save();

  await broadcastToPartners(user, false);
}

/** Scheduled sweep (node-cron, every minute) — TTL-based offline detection. */
async function markStaleUsersOffline() {
  const User = require('../models/User');
  const cutoff = new Date(Date.now() - OFFLINE_TTL_MINUTES * 60 * 1000);
  const staleUsers = await User.find({ is_online: true, last_seen_at: { $lt: cutoff } });
  for (const user of staleUsers) {
    await markOffline(user);
  }
}

/** Re-evaluates against the TTL so a stale DB row doesn't mislead API responses. */
function getPresence(user) {
  const isOnline = !!user.is_online && !!user.last_seen_at && user.last_seen_at.getTime() > Date.now() - OFFLINE_TTL_MINUTES * 60 * 1000;
  return { is_online: isOnline, last_seen_at: user.last_seen_at ? user.last_seen_at.toISOString() : null };
}

module.exports = { markOnline, markOffline, markStaleUsersOffline, getPresence, OFFLINE_TTL_MINUTES };
