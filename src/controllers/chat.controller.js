const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const chatService = require('../services/chat.service');
const Conversation = require('../models/Conversation');
const { notifyUser } = require('../services/notification.service');
const pusher = require('../integrations/pusher');
const blockService = require('../services/block.service');

const getConversationList = asyncHandler(async (req, res) => {
  const data = await chatService.getConversationList(req.user.id);
  return success(res, data, 'Conversations fetched successfully.');
});

const getMessages = asyncHandler(async (req, res) => {
  const data = await chatService.getMessages(req.query.conversation_id, req.user.id);
  return success(res, data, 'Messages fetched successfully.');
});

const sendMessage = asyncHandler(async (req, res) => {
  const sender = req.user;
  const conversationId = req.body.conversation_id;
  const messageType = req.body.type || 'text';

  const data = await chatService.sendMessage(conversationId, sender.id, req.body.message, messageType);

  pusher.trigger(`conversation.${conversationId}`, 'ConversationEvent', {
    type: 'new_message',
    id: data.id,
    sender_id: sender.id,
    sender_name: sender.name,
    message: data.message,
    message_type: messageType,
    tick_status: data.tick_status,
    sent_at: data.sent_at,
  });

  const conversation = await Conversation.findById(conversationId).select('participants');
  const recipientIds = conversation.participants.filter((p) => String(p.user_id) !== String(sender.id)).map((p) => p.user_id);

  const preview = messageType === 'text' ? req.body.message.slice(0, 60) : `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)}]`;

  for (const recipientId of recipientIds) {
    notifyUser(recipientId, 'new_message_notification', { conversation_id: conversationId, sender_id: sender.id, sender_name: sender.name, preview, message_type: messageType }, {
      actorId: sender.id,
      relatedType: 'Conversation',
      relatedId: conversationId,
      title: 'New Message',
      body: `${sender.name} sent you a new message`,
    });
  }

  return success(res, data, 'Message sent.', 201);
});

const markDelivered = asyncHandler(async (req, res) => {
  const data = await chatService.markDelivered(req.body.conversation_id, req.user.id);
  return success(res, data, 'Marked as delivered.');
});

const markRead = asyncHandler(async (req, res) => {
  const reader = req.user;
  const conversationId = req.body.conversation_id;
  const data = await chatService.markRead(conversationId, reader.id);

  pusher.trigger(`conversation.${conversationId}`, 'ConversationEvent', {
    type: 'message_read',
    reader_id: reader.id,
    reader_name: reader.name,
    read_at: new Date().toISOString(),
  });

  return success(res, data, 'Marked as read.');
});

const typing = asyncHandler(async (req, res) => {
  const user = req.user;
  const conversationId = req.body.conversation_id;

  const Conv = await Conversation.findById(conversationId).select('participants');
  const isParticipant = Conv && Conv.participants.some((p) => String(p.user_id) === String(user.id));
  if (!isParticipant) return error(res, 'You are not a participant of this conversation.', 403, []);

  const other = Conv.participants.find((p) => String(p.user_id) !== String(user.id));
  if (other) {
    const { blocked } = await blockService.getBlockStatus(user.id, other.user_id);
    if (blocked) return error(res, 'Action not allowed.', 403, []);
  }

  pusher.trigger(`conversation.${conversationId}`, 'ConversationEvent', {
    type: req.body.is_typing ? 'typing' : 'stop_typing',
    user_id: user.id,
    user_name: user.name,
  });

  return success(res, [], 'OK');
});

const clearChat = asyncHandler(async (req, res) => {
  await chatService.clearChat(req.body.conversation_id, req.user.id);
  return success(res, [], 'Chat cleared successfully.');
});

const blockUser = asyncHandler(async (req, res) => {
  const data = await chatService.blockUserChat(req.user, req.body.conversation_id, req.body.blocked_user_id);
  return success(res, data, 'User blocked successfully.');
});

const unblockUser = asyncHandler(async (req, res) => {
  const data = await chatService.unblockUserChat(req.user, req.body.conversation_id, req.body.blocked_user_id);
  return success(res, data, 'User unblocked successfully.');
});

const getBlockedUsers = asyncHandler(async (req, res) => {
  const data = await chatService.getBlockedUsersChat(req.user.id, Number(req.query.page) || 1);
  return success(res, data, 'Blocked users fetched successfully.');
});

module.exports = {
  getConversationList,
  getMessages,
  sendMessage,
  markDelivered,
  markRead,
  typing,
  clearChat,
  blockUser,
  unblockUser,
  getBlockedUsers,
};
