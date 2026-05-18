const { Server } = require('socket.io');
const { socketAuth } = require('./middleware/socketAuth');
const { 
  getMessagesCollection, 
  getConversationsCollection,
  getUsersCollection 
} = require('./config/db');
const { ObjectId } = require('mongodb');

// Store online users
const onlineUsers = new Map();

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.id})`);
    
    // Add user to online users
    onlineUsers.set(socket.user.id, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });
    
    // Broadcast online status to all users
    io.emit('user_online', {
      userId: socket.user.id,
      name: socket.user.name,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(`user_${socket.user.id}`);
    
    // Send list of online users to new user
    const onlineUsersList = Array.from(onlineUsers.values()).map(u => ({
      userId: u.user.id,
      name: u.user.name,
      lastSeen: u.lastSeen
    }));
    socket.emit('online_users', onlineUsersList);

    // Handle joining a conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`${socket.user.name} joined conversation: ${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, type = 'text', replyTo = null } = data;
        
        const messagesCollection = getMessagesCollection();
        const conversationsCollection = getConversationsCollection();
        
        // Create message object
        const message = {
          _id: new ObjectId(),
          conversationId: new ObjectId(conversationId),
          senderId: new ObjectId(socket.user.id),
          senderName: socket.user.name,
          content: content,
          type: type,
          attachments: [],
          isRead: false,
          readBy: [{ userId: new ObjectId(socket.user.id), readAt: new Date() }],
          isEdited: false,
          isDeleted: false,
          replyTo: replyTo,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Save message to database
        await messagesCollection.insertOne(message);
        
        // Update conversation's last message
        await conversationsCollection.updateOne(
          { _id: new ObjectId(conversationId) },
          { 
            $set: { 
              lastMessage: content,
              lastMessageAt: new Date(),
              lastMessageBy: socket.user.id,
              updatedAt: new Date()
            },
            $inc: { unreadCount: 1 }
          }
        );
        
        // Format message for emission
        const formattedMessage = {
          ...message,
          _id: message._id.toString(),
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          readBy: message.readBy.map(rb => ({ ...rb, userId: rb.userId.toString() }))
        };
        
        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit('new_message', formattedMessage);
        
        // Notify participants (except sender)
        const conversation = await conversationsCollection.findOne({ 
          _id: new ObjectId(conversationId) 
        });
        
        if (conversation) {
          conversation.participants.forEach(participant => {
            if (participant.userId.toString() !== socket.user.id) {
              io.to(`user_${participant.userId.toString()}`).emit('message_notification', {
                conversationId: conversationId,
                message: content,
                sender: socket.user.name,
                timestamp: new Date()
              });
            }
          });
        }
        
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId, isTyping } = data;
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.user.id,
        name: socket.user.name,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.user.id,
        name: socket.user.name,
        isTyping: false
      });
    });

    // Handle marking messages as read
    socket.on('mark_as_read', async (data) => {
      try {
        const { conversationId, messageIds } = data;
        const messagesCollection = getMessagesCollection();
        
        await messagesCollection.updateMany(
          {
            _id: { $in: messageIds.map(id => new ObjectId(id)) },
            conversationId: new ObjectId(conversationId),
            'readBy.userId': { $ne: new ObjectId(socket.user.id) }
          },
          {
            $push: {
              readBy: { userId: new ObjectId(socket.user.id), readAt: new Date() }
            }
          }
        );
        
        socket.to(`conversation_${conversationId}`).emit('messages_read', {
          userId: socket.user.id,
          messageIds: messageIds
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.user.id})`);
      
      onlineUsers.delete(socket.user.id);
      
      // Broadcast offline status
      io.emit('user_offline', {
        userId: socket.user.id,
        name: socket.user.name,
        lastSeen: new Date()
      });
    });
  });

  return io;
}

module.exports = { initializeSocket, onlineUsers };