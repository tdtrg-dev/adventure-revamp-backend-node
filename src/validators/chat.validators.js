const Joi = require('joi');
const { objectId } = require('./common');

const conversationIdQuery = Joi.object({
  conversation_id: objectId().required(),
  page: Joi.number().integer().min(1),
});

const conversationIdOnly = Joi.object({
  conversation_id: objectId().required(),
});

const sendMessage = Joi.object({
  conversation_id: objectId().required(),
  message: Joi.string().max(5000).required(),
  type: Joi.string().valid('text', 'image', 'video', 'file', 'audio').allow(null, ''),
});

const typing = Joi.object({
  conversation_id: objectId().required(),
  is_typing: Joi.boolean().required(),
});

const blockUnblock = Joi.object({
  conversation_id: objectId().allow(null, ''),
  blocked_user_id: objectId().allow(null, ''),
})
  .or('conversation_id', 'blocked_user_id')
  .messages({ 'object.missing': '"conversation_id" or "blocked_user_id" is required' });

module.exports = { conversationIdQuery, conversationIdOnly, sendMessage, typing, blockUnblock };
