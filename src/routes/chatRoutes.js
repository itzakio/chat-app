const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  deleteMessage,
  searchUsers
} = require('../controllers/chatController');

// All routes are protected
router.use(protect);

// User search
router.get('/users/search', searchUsers);

// Conversations
router.post('/conversation', getOrCreateConversation);
router.get('/conversations', getUserConversations);

// Messages
router.get('/messages/:conversationId', getConversationMessages);
router.delete('/messages/:messageId', deleteMessage);

module.exports = router;