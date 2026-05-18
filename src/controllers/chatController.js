const { ObjectId } = require('mongodb');
const { 
  getMessagesCollection, 
  getConversationsCollection,
  getUsersCollection 
} = require('../config/db');

// @desc    Get or create a conversation between users
// @route   POST /api/chat/conversation
const getOrCreateConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const currentUserId = req.user._id;
    
    const conversationsCollection = getConversationsCollection();
    const usersCollection = getUsersCollection();
    
    // Check if conversation already exists
    let conversation = await conversationsCollection.findOne({
      participants: { 
        $all: [
          { $elemMatch: { userId: new ObjectId(currentUserId) } },
          { $elemMatch: { userId: new ObjectId(participantId) } }
        ]
      }
    });
    
    if (!conversation) {
      // Get participant details
      const participant = await usersCollection.findOne({ 
        _id: new ObjectId(participantId) 
      });
      
      const currentUser = await usersCollection.findOne({ 
        _id: new ObjectId(currentUserId) 
      });
      
      // Create new conversation
      const newConversation = {
        _id: new ObjectId(),
        participants: [
          {
            userId: new ObjectId(currentUserId),
            name: currentUser.name,
            email: currentUser.email,
            lastSeen: null,
            joinedAt: new Date()
          },
          {
            userId: new ObjectId(participantId),
            name: participant.name,
            email: participant.email,
            lastSeen: null,
            joinedAt: new Date()
          }
        ],
        lastMessage: null,
        lastMessageAt: null,
        lastMessageBy: null,
        unreadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await conversationsCollection.insertOne(newConversation);
      conversation = await conversationsCollection.findOne({ _id: result.insertedId });
    }
    
    res.status(200).json({
      success: true,
      conversation: {
        ...conversation,
        _id: conversation._id.toString(),
        participants: conversation.participants.map(p => ({
          ...p,
          userId: p.userId.toString()
        }))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's conversations
// @route   GET /api/chat/conversations
const getUserConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const conversationsCollection = getConversationsCollection();
    
    const conversations = await conversationsCollection
      .find({
        'participants.userId': new ObjectId(currentUserId)
      })
      .sort({ lastMessageAt: -1 })
      .toArray();
    
    const formattedConversations = conversations.map(conv => ({
      ...conv,
      _id: conv._id.toString(),
      participants: conv.participants.map(p => ({
        ...p,
        userId: p.userId.toString()
      }))
    }));
    
    res.status(200).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/messages/:conversationId
const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const messagesCollection = getMessagesCollection();
    
    const messages = await messagesCollection
      .find({ conversationId: new ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .toArray();
    
    const formattedMessages = messages.map(msg => ({
      ...msg,
      _id: msg._id.toString(),
      conversationId: msg.conversationId.toString(),
      senderId: msg.senderId.toString(),
      readBy: msg.readBy.map(rb => ({ ...rb, userId: rb.userId.toString() }))
    }));
    
    res.status(200).json({
      success: true,
      messages: formattedMessages.reverse(),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/chat/messages/:messageId
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const messagesCollection = getMessagesCollection();
    
    const message = await messagesCollection.findOne({ 
      _id: new ObjectId(messageId) 
    });
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Check if user is the sender
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }
    
    await messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { isDeleted: true, content: '[Message deleted]' } }
    );
    
    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search users for chat
// @route   GET /api/chat/users/search
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const usersCollection = getUsersCollection();
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }
    
    const users = await usersCollection
      .find({
        _id: { $ne: new ObjectId(req.user._id) },
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      })
      .limit(20)
      .project({ password: 0 })
      .toArray();
    
    const formattedUsers = users.map(user => ({
      ...user,
      _id: user._id.toString()
    }));
    
    res.status(200).json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  deleteMessage,
  searchUsers
};