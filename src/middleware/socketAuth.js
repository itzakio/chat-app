const jwt = require('jsonwebtoken');
const { getUsersCollection } = require('../config/db');
const { ObjectId } = require('mongodb');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usersCollection = getUsersCollection();
    
    const user = await usersCollection.findOne({ 
      _id: new ObjectId(decoded.id) 
    });
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user to socket
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = { socketAuth };