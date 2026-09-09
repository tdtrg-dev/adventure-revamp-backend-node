const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const connectionService = require('../services/connection.service');
const { notifyUser } = require('../services/notification.service');

const sendRequest = asyncHandler(async (req, res) => {
  const sender = req.user;
  const receiverId = req.body.receiver_id;
  const connection = await connectionService.sendRequest(sender.id, receiverId);

  await notifyUser(receiverId, 'connection_request', { sender_id: sender.id, sender_name: sender.name }, {
    actorId: sender.id,
    relatedType: 'Connection',
    relatedId: connection.id,
    title: 'Connection Request',
    body: `${sender.name} has sent you connection request`,
  });

  return success(res, connection, 'Connection request sent successfully.');
});

const cancelRequest = asyncHandler(async (req, res) => {
  await connectionService.cancelRequest(req.user.id, req.body.connection_id);
  return success(res, [], 'Connection request cancelled.');
});

const updateRequestStatus = asyncHandler(async (req, res) => {
  const actor = req.user;
  const connectionId = req.body.connection_id;
  const result = await connectionService.updateRequestStatus(connectionId, actor.id, req.body.status);
  const originalSenderId = result.sender_id;

  if (originalSenderId) {
    const notifType = req.body.status === 'accepted' ? 'connection_accepted' : 'connection_rejected';
    await notifyUser(originalSenderId, notifType, { actor_id: actor.id, actor_name: actor.name }, {
      actorId: actor.id,
      relatedType: 'Connection',
      relatedId: connectionId,
      title: 'Connection Update',
      body: `Your connection request has been ${req.body.status}`,
    });
  }

  const message = req.body.status === 'accepted' ? 'Connection request accepted.' : 'Connection request rejected.';
  return success(res, result, message);
});

const blockUser = asyncHandler(async (req, res) => {
  await connectionService.blockUser(req.user.id, req.body.blocked_id);
  return success(res, [], 'User blocked successfully.');
});

const unblockUser = asyncHandler(async (req, res) => {
  await connectionService.unblockUser(req.user.id, req.body.blocked_id);
  return success(res, [], 'User unblocked successfully.');
});

const getPendingRequests = asyncHandler(async (req, res) => {
  const data = await connectionService.getPendingRequests(req.user.id, Number(req.query.page) || 1);
  return success(res, data, 'Pending requests retrieved successfully.');
});

const getConnections = asyncHandler(async (req, res) => {
  const data = await connectionService.getConnections(req.body.current_user_id, req.body.current_user_id, Number(req.body.page) || 1);
  return success(res, data, 'Connections retrieved successfully.');
});

const getBlockedUsers = asyncHandler(async (req, res) => {
  const data = await connectionService.getBlockedUsers(req.user.id, Number(req.query.page) || 1);
  return success(res, data, 'Blocked users retrieved successfully.');
});

const unfriend = asyncHandler(async (req, res) => {
  await connectionService.unfriend(req.user.id, req.body.connection_id);
  return success(res, [], 'Connection removed successfully.');
});

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
