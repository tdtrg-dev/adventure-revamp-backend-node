const Joi = require('joi');
const { objectId } = require('./common');

const sendRequest = Joi.object({
  receiver_id: objectId().required(),
});

const connectionIdOnly = Joi.object({
  connection_id: objectId().required(),
});

const cancelRequest = connectionIdOnly;

const updateRequestStatus = Joi.object({
  connection_id: objectId().required(),
  status: Joi.string().valid('accepted', 'rejected').required(),
});

const blockedIdOnly = Joi.object({
  blocked_id: objectId().required(),
});

const getConnections = Joi.object({
  current_user_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const unfriend = connectionIdOnly;

module.exports = { sendRequest, cancelRequest, updateRequestStatus, blockedIdOnly, getConnections, unfriend };
