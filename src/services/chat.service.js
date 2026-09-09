const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const User = require('../models/User');
const presenceService = require('./presence.service');
const blockService = require('./block.service');
const pusher = require('../integrations/pusher');
const { notifyUser } = require('./notification.service');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function tickStatus(msg) {
  if (msg.read_at) return 'read';
  if (msg.delivered_at) return 'delivered';
  return 'sent';
}

// p.user_id may be a raw ObjectId or a populated User document depending on the
// caller's query — normalize to its id string either way before comparing.
function participantUserId(p) {
  return String(p.user_id?._id || p.user_id);
}

function otherParticipant(conversation, userId) {
  return conversation.participants.find((p) => participantUserId(p) !== String(userId));
}

async function getConversationList(userId) {
  const conversations = await Conversation.find({ 'participants.user_id': userId, deleted_at: null })
    .populate('participants.user_id', 'name email is_online last_seen_at profile.image')
    .populate('group_id', 'title group_photo group_type')
    .populate('last_message_id')
    .sort({ updated_at: -1 });

  // Group conversations only surface here when linked to an event-type group (matches Laravel).
  const filtered = conversations.filter((c) => !c.is_group || c.group_id?.group_type === 'event');

  const otherUserIds = filtered.filter((c) => !c.is_group).map((c) => otherParticipant(c, userId)?.user_id?._id).filter(Boolean);

  const [blockersOfMe, myBlocked] = await Promise.all([
    User.find({ blocked_users: userId, _id: { $in: otherUserIds } }).select('_id'),
    User.findById(userId).select('blocked_users'),
  ]);
  const blockedMeIds = new Set(blockersOfMe.map((u) => String(u._id)));
  const iBlockedIds = new Set((myBlocked.blocked_users || []).map(String));

  const data = await Promise.all(
    filtered.map(async (conv) => {
      const other = conv.is_group ? null : otherParticipant(conv, userId);
      const otherUser = other?.user_id;
      const otherUserId = otherUser?._id;

      const blockedByMe = otherUserId ? iBlockedIds.has(String(otherUserId)) : false;
      const blockedByThem = otherUserId ? blockedMeIds.has(String(otherUserId)) : false;

      const unreadCount = await Message.countDocuments({ conversation_id: conv._id, sender_id: { $ne: userId }, read_at: null, deleted_at: null });

      const lastMsg = conv.last_message_id;

      return {
        conversation_id: conv.id,
        is_group: conv.is_group,
        group_id: conv.group_id?.id || null,
        name: conv.is_group ? conv.group_id?.title || conv.name : otherUser?.name,
        image: conv.is_group ? conv.group_id?.group_photo || null : otherUser?.profile?.image || null,
        other_user_id: otherUserId || null,
        other_user_presence: conv.is_group ? null : otherUser ? presenceService.getPresence(otherUser) : null,
        is_blocked: blockedByMe || blockedByThem,
        blocked_by_me: blockedByMe,
        blocked_by_them: blockedByThem,
        unread_count: unreadCount,
        last_message: lastMsg
          ? {
              id: lastMsg.id,
              message: lastMsg.type === 'text' ? lastMsg.message : lastMsg.type.charAt(0).toUpperCase() + lastMsg.type.slice(1),
              type: lastMsg.type,
              sent_at: lastMsg.created_at.toISOString().slice(0, 16).replace('T', ' '),
              tick_status: tickStatus(lastMsg),
              is_mine: String(lastMsg.sender_id) === String(userId),
            }
          : null,
      };
    })
  );

  return data;
}

async function getMessages(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw fail('You are not a participant of this conversation.');
  const myParticipant = conversation.participants.find((p) => String(p.user_id) === String(userId));
  if (!myParticipant) throw fail('You are not a participant of this conversation.');

  const other = otherParticipant(conversation, userId);
  let blockStatus = null;
  if (other) {
    const status = await blockService.getBlockStatus(userId, other.user_id);
    if (status.blockedByMe) blockStatus = 'blocked_by_me';
    else if (status.blockedByThem) blockStatus = 'blocked_by_them';
  }

  const query = { conversation_id: conversationId, deleted_at: null };
  if (myParticipant.deleted_until) query.created_at = { $gt: myParticipant.deleted_until };

  const messages = await Message.find(query).populate('sender_id', 'name').sort({ _id: 1 });

  return {
    block_status: blockStatus,
    messages: messages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id?.id || m.sender_id,
      sender_name: m.sender_id?.name,
      message: m.message,
      type: m.type,
      tick_status: tickStatus(m),
      sent_at: m.created_at.toISOString().replace('T', ' ').slice(0, 19),
      is_mine: String(m.sender_id?._id || m.sender_id) === String(userId),
    })),
  };
}

async function sendMessage(conversationId, senderId, message, type = 'text') {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.some((p) => String(p.user_id) === String(senderId))) {
    throw fail('You are not a participant of this conversation.');
  }

  const other = otherParticipant(conversation, senderId);
  if (other) {
    const { blocked } = await blockService.getBlockStatus(senderId, other.user_id);
    if (blocked) throw fail('Cannot send message — block exists between users.');
  }

  const msg = await Message.create({ conversation_id: conversationId, sender_id: senderId, message, type });
  conversation.last_message_id = msg._id;
  conversation.updated_at = new Date();
  await conversation.save();

  return {
    id: msg.id,
    sender_id: senderId,
    message: msg.message,
    type: msg.type,
    tick_status: 'sent',
    sent_at: msg.created_at.toISOString().replace('T', ' ').slice(0, 19),
  };
}

async function markDelivered(conversationId, userId) {
  const result = await Message.updateMany(
    { conversation_id: conversationId, sender_id: { $ne: userId }, delivered_at: null, deleted_at: null },
    { delivered_at: new Date() }
  );
  return { updated: result.modifiedCount };
}

async function markRead(conversationId, userId) {
  const now = new Date();
  const unread = await Message.find({ conversation_id: conversationId, sender_id: { $ne: userId }, read_at: null, deleted_at: null });
  for (const msg of unread) {
    if (!msg.delivered_at) msg.delivered_at = now;
    msg.read_at = now;
    await msg.save();
  }
  return { updated: unread.length };
}

async function clearChat(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  const participant = conversation?.participants.find((p) => String(p.user_id) === String(userId));
  if (!participant) throw fail('Conversation not found.');
  participant.deleted_until = new Date();
  await conversation.save();
}

async function resolveConversationAndUser(blockerId, conversationId, blockedUserId) {
  if (conversationId && !blockedUserId) {
    const conversation = await Conversation.findById(conversationId);
    const other = conversation && otherParticipant(conversation, blockerId);
    if (!other) throw fail('Conversation not found or you are not a participant.');
    blockedUserId = other.user_id;
  }

  if (blockedUserId && !conversationId) {
    const conversation = await Conversation.findOne({
      is_group: false,
      deleted_at: null,
      $and: [{ 'participants.user_id': blockerId }, { 'participants.user_id': blockedUserId }],
    });
    conversationId = conversation ? conversation._id : null;
  }

  return { conversationId, blockedUserId };
}

async function blockUserChat(blocker, conversationId, blockedUserId) {
  const resolved = await resolveConversationAndUser(blocker.id, conversationId, blockedUserId);
  conversationId = resolved.conversationId;
  blockedUserId = resolved.blockedUserId;

  if (String(blocker.id) === String(blockedUserId)) throw fail('You cannot block yourself.');
  if (await blockService.isBlockedByMe(blocker.id, blockedUserId)) throw fail('User is already blocked.');

  await blockService.block(blocker.id, blockedUserId);
  await Connection.deleteMany({
    $or: [
      { sender_id: blocker.id, receiver_id: blockedUserId },
      { sender_id: blockedUserId, receiver_id: blocker.id },
    ],
  });

  if (conversationId) {
    pusher.trigger(`conversation.${conversationId}`, 'ConversationEvent', {
      type: 'user_blocked',
      blocker_id: blocker.id,
      blocker_name: blocker.name,
      blocked_id: blockedUserId,
    });
  }
  await notifyUser(blockedUserId, 'user_blocked', { blocker_id: blocker.id, blocker_name: blocker.name }, { actorId: blocker.id, saveToDb: false });

  return { conversation_id: conversationId, blocked_user_id: blockedUserId, is_blocked: true, blocked_by_me: true };
}

async function unblockUserChat(blocker, conversationId, blockedUserId) {
  const resolved = await resolveConversationAndUser(blocker.id, conversationId, blockedUserId);
  conversationId = resolved.conversationId;
  blockedUserId = resolved.blockedUserId;

  if (!(await blockService.isBlockedByMe(blocker.id, blockedUserId))) throw fail('No block record found. User was not blocked by you.');
  await blockService.unblock(blocker.id, blockedUserId);

  if (conversationId) {
    pusher.trigger(`conversation.${conversationId}`, 'ConversationEvent', {
      type: 'user_unblocked',
      blocker_id: blocker.id,
      unblocked_id: blockedUserId,
    });
  }

  return { conversation_id: conversationId, unblocked_user_id: blockedUserId, is_blocked: false, blocked_by_me: false };
}

async function getBlockedUsersChat(userId, page = 1) {
  const result = await blockService.getBlockedByUser(userId, page);
  return {
    data: result.users.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.profile?.image || null })),
    pagination: { current_page: result.page, per_page: result.per_page, total: result.total, last_page: result.last_page },
  };
}

module.exports = {
  getConversationList,
  getMessages,
  sendMessage,
  markDelivered,
  markRead,
  clearChat,
  blockUserChat,
  unblockUserChat,
  getBlockedUsersChat,
};
