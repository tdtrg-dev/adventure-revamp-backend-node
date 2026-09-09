const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/chat.validators');
const controller = require('../controllers/chat.controller');

router.get('/conversations', authenticate, controller.getConversationList);
router.get('/messages', authenticate, validate(v.conversationIdQuery, 'query'), controller.getMessages);
router.post('/send-message', authenticate, validate(v.sendMessage), controller.sendMessage);
router.post('/typing', authenticate, validate(v.typing), controller.typing);
router.post('/mark-delivered', authenticate, validate(v.conversationIdOnly), controller.markDelivered);
router.post('/mark-read', authenticate, validate(v.conversationIdOnly), controller.markRead);
router.post('/clear-chat', authenticate, validate(v.conversationIdOnly), controller.clearChat);

router.post('/chat/block', authenticate, validate(v.blockUnblock), controller.blockUser);
router.post('/chat/unblock', authenticate, validate(v.blockUnblock), controller.unblockUser);
router.get('/chat/blocked-users', authenticate, controller.getBlockedUsers);

module.exports = router;
