const Connection = require('../models/Connection');
const User = require('../models/User');
const Event = require('../models/Event');
const Post = require('../models/Post');
const Conversation = require('../models/Conversation');
const blockService = require('./block.service');
const { datetimeStr } = require('../utils/dateFormat');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function sendRequest(senderId, receiverId) {
  if (String(senderId) === String(receiverId)) throw fail('You cannot send a connection request to yourself.');

  const { blocked } = await blockService.getBlockStatus(senderId, receiverId);
  if (blocked) throw fail('Action not allowed due to block settings.');

  const existing = await Connection.findOne({
    $or: [
      { sender_id: senderId, receiver_id: receiverId },
      { sender_id: receiverId, receiver_id: senderId },
    ],
  });
  if (existing) throw fail('A connection request already exists or you are already connected.');

  return Connection.create({ sender_id: senderId, receiver_id: receiverId, status: 'pending' });
}

async function cancelRequest(senderId, connectionId) {
  const connection = await Connection.findOne({ _id: connectionId, sender_id: senderId, status: 'pending' });
  if (!connection) throw fail('Pending request not found or you are not the sender.');
  await connection.deleteOne();
}

async function updateRequestStatus(connectionId, userId, status) {
  const connection = await Connection.findOne({ _id: connectionId, receiver_id: userId, status: 'pending' });
  if (!connection) throw fail('Connection request not found or already processed.');

  const senderId = connection.sender_id;

  if (status === 'rejected') {
    await connection.deleteOne();
    return { status: 'rejected', connection_id: connectionId, sender_id: senderId };
  }

  connection.status = 'accepted';
  await connection.save();

  const existing = await Conversation.findOne({
    is_group: false,
    deleted_at: null,
    $and: [{ 'participants.user_id': connection.sender_id }, { 'participants.user_id': connection.receiver_id }],
  });

  if (!existing) {
    await Conversation.create({
      is_group: false,
      participants: [{ user_id: connection.sender_id }, { user_id: connection.receiver_id }],
    });
  }

  return connection;
}

async function blockUser(blockerId, blockedId) {
  if (String(blockerId) === String(blockedId)) throw fail('You cannot block yourself.');

  await blockService.block(blockerId, blockedId);
  await Connection.deleteMany({
    $or: [
      { sender_id: blockerId, receiver_id: blockedId },
      { sender_id: blockedId, receiver_id: blockerId },
    ],
  });
}

async function unblockUser(blockerId, blockedId) {
  await blockService.unblock(blockerId, blockedId);
}

async function getPendingRequests(userId, page = 1) {
  const perPage = 20;
  const query = { receiver_id: userId, status: 'pending' };
  const total = await Connection.countDocuments(query);
  const items = await Connection.find(query)
    .populate('sender_id', 'name email is_online last_seen_at profile.image')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  return { data: items, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getConnections(userId, currentUserId, page = 1) {
  const perPage = 20;

  const myConnections = await Connection.find({ $or: [{ sender_id: currentUserId }, { receiver_id: currentUserId }], status: 'accepted' });
  const myFriendIds = new Set(
    myConnections.map((c) => (String(c.sender_id) === String(currentUserId) ? String(c.receiver_id) : String(c.sender_id)))
  );

  const allWithCurrentUser = await Connection.find({ $or: [{ sender_id: currentUserId }, { receiver_id: currentUserId }] });
  const sentByMe = new Map();
  const sentToMe = new Map();
  allWithCurrentUser.forEach((c) => {
    if (String(c.sender_id) === String(currentUserId)) sentByMe.set(String(c.receiver_id), c);
    else sentToMe.set(String(c.sender_id), c);
  });

  const query = { status: 'accepted', $or: [{ sender_id: userId }, { receiver_id: userId }] };
  const total = await Connection.countDocuments(query);
  const connections = await Connection.find(query)
    .populate('sender_id', 'name email is_online last_seen_at profile.image')
    .populate('receiver_id', 'name email is_online last_seen_at profile.image')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const friendIds = connections.map((c) => (String(c.sender_id.id) === String(userId) ? c.receiver_id.id : c.sender_id.id));

  const [eventOrganizerIds, communityMemberIds] = await Promise.all([
    Event.find({ organizer_id: { $in: friendIds }, status: 'publish' }).distinct('organizer_id'),
    Post.find({ user_id: { $in: friendIds }, status: 'publish' }).distinct('user_id'),
  ]);
  const organizerSet = new Set(eventOrganizerIds.map(String));
  const memberSet = new Set(communityMemberIds.map(String));

  const data = await Promise.all(
    connections.map(async (conn) => {
      const friend = String(conn.sender_id.id) === String(userId) ? conn.receiver_id : conn.sender_id;

      const theirConnections = await Connection.find({ $or: [{ sender_id: friend.id }, { receiver_id: friend.id }], status: 'accepted' });
      const theirFriendIds = new Set(
        theirConnections.map((c) => (String(c.sender_id) === String(friend.id) ? String(c.receiver_id) : String(c.sender_id)))
      );
      const mutualCount = [...myFriendIds].filter((id) => theirFriendIds.has(id)).length;

      let connectionStatus = null;
      let connectionId = null;
      if (String(friend.id) === String(currentUserId)) {
        connectionStatus = 'self';
      } else if (sentByMe.has(String(friend.id))) {
        const row = sentByMe.get(String(friend.id));
        connectionStatus = row.status === 'accepted' ? 'friends' : 'request_sent';
        connectionId = row.id;
      } else if (sentToMe.has(String(friend.id))) {
        const row = sentToMe.get(String(friend.id));
        connectionStatus = row.status === 'accepted' ? 'friends' : 'request_received';
        connectionId = row.id;
      }

      return {
        connection_id: conn.id,
        connected_at: datetimeStr(conn.created_at),
        user: {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          image: friend.profile?.image || null,
          is_online: friend.is_online,
          last_seen_at: datetimeStr(friend.last_seen_at),
        },
        mutual_friends: mutualCount,
        is_event_organizer: organizerSet.has(String(friend.id)),
        is_community_member: memberSet.has(String(friend.id)),
        connection_status: connectionStatus,
        connection_id_with_current_user: connectionId,
      };
    })
  );

  return { data, pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) } };
}

async function getBlockedUsers(userId, page = 1) {
  const result = await blockService.getBlockedByUser(userId, page);
  return {
    data: result.users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    pagination: { current_page: result.page, per_page: result.per_page, total: result.total, last_page: result.last_page },
  };
}

async function unfriend(userId, connectionId) {
  const connection = await Connection.findOne({
    _id: connectionId,
    status: 'accepted',
    $or: [{ sender_id: userId }, { receiver_id: userId }],
  });
  if (!connection) throw fail('Connection not found or you are not part of this connection.');
  await connection.deleteOne();
}

module.exports = {
  sendRequest,
  cancelRequest,
  updateRequestStatus,
  blockUser,
  unblockUser,
  getPendingRequests,
  getConnections,
  getBlockedUsers,
  unfriend,
};
