const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
    
    console.log(`✅ MongoDB Atlas Connected to: ${db.databaseName}`);
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check your internet connection');
    console.log('2. Verify your Atlas username and password in .env file');
    console.log('3. Make sure your IP address is whitelisted in MongoDB Atlas');
    console.log('4. Check if your cluster is active (not paused)');
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const usersCollection = db.collection('users');
    const messagesCollection = db.collection('messages');
    const conversationsCollection = db.collection('conversations');
    
    // User indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ createdAt: -1 });
    
    // Message indexes
    await messagesCollection.createIndex({ conversationId: 1 });
    await messagesCollection.createIndex({ createdAt: -1 });
    await messagesCollection.createIndex({ conversationId: 1, createdAt: -1 });
    
    // Conversation indexes
    await conversationsCollection.createIndex({ participants: 1 });
    await conversationsCollection.createIndex({ 'participants.userId': 1 });
    await conversationsCollection.createIndex({ lastMessageAt: -1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return db;
};

const getUsersCollection = () => getDB().collection('users');
const getTokensCollection = () => getDB().collection('tokens');
const getMessagesCollection = () => getDB().collection('messages');
const getConversationsCollection = () => getDB().collection('conversations');

const closeDB = async () => {
  if (client) {
    await client.close();
    console.log('Database connection closed');
  }
};

module.exports = { 
  connectDB, 
  getDB, 
  getUsersCollection, 
  getTokensCollection,
  getMessagesCollection,
  getConversationsCollection,
  closeDB 
};