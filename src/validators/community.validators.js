const Joi = require('joi');
const { objectId } = require('./common');

const createPost = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  event_link: Joi.string().uri().allow(null, ''),
  visibility: Joi.string().valid('Public', 'Friends', 'Private').allow(null, ''),
  interests: Joi.array().items(objectId()).allow(null),
}).unknown(true);

const createGroupPost = Joi.object({
  group_id: objectId().required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().required(),
  event_link: Joi.string().uri().allow(null, ''),
}).unknown(true);

const updateGroupPost = Joi.object({
  title: Joi.string().max(255).allow(null, ''),
  description: Joi.string().allow(null, ''),
  event_link: Joi.string().uri().allow(null, ''),
}).unknown(true);

const updatePost = Joi.object({
  title: Joi.string().allow(null, ''),
  description: Joi.string().allow(null, ''),
  event_link: Joi.string().uri().allow(null, ''),
  visibility: Joi.string().valid('Public', 'Friends', 'Private').allow(null, ''),
  interests: Joi.array().items(objectId()).allow(null),
}).unknown(true);

const addComment = Joi.object({
  post_id: objectId().required(),
  parent_id: objectId().allow(null, ''),
  comment: Joi.string().required(),
});

const updateComment = Joi.object({
  comment: Joi.string().required(),
});

const toggleReaction = Joi.object({
  post_id: objectId().required(),
  reaction_type: Joi.string().required(),
});

const postIdOnly = Joi.object({
  post_id: objectId().required(),
});

const reportPost = Joi.object({
  post_id: objectId().required(),
  reason: Joi.string().required(),
});

const actionReportedPost = Joi.object({
  report_id: objectId().required(),
  action: Joi.string().valid('remove', 'warn', 'suspend', 'dismiss').required(),
  remarks: Joi.string().allow(null, ''),
});

const toggleFollowUser = Joi.object({
  user_id: objectId().required(),
});

const createGroup = Joi.object({
  title: Joi.string().max(255).required(),
  visibility: Joi.string().valid('Public', 'Private').required(),
  group_type: Joi.string().valid('event', 'community').allow(null, ''),
  event_id: objectId().allow(null, ''),
}).unknown(true);

const groupIdOnly = Joi.object({
  group_id: objectId().required(),
});

const inviteUserToGroup = Joi.object({
  group_id: objectId().required(),
  user_id: objectId().required(),
});

const actionGroupInvitation = Joi.object({
  request_id: objectId().required(),
  action: Joi.string().valid('confirm', 'cancel').required(),
});

const actionGroupRequest = Joi.object({
  request_id: objectId().required(),
  action: Joi.string().valid('approve', 'reject').required(),
});

const removeMember = Joi.object({
  group_id: objectId().required(),
  user_id: objectId().required(),
});

module.exports = {
  createPost,
  createGroupPost,
  updateGroupPost,
  updatePost,
  addComment,
  updateComment,
  toggleReaction,
  postIdOnly,
  reportPost,
  actionReportedPost,
  toggleFollowUser,
  createGroup,
  groupIdOnly,
  inviteUserToGroup,
  actionGroupInvitation,
  actionGroupRequest,
  removeMember,
};
