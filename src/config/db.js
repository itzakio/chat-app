const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
  try {
    // Create MongoDB client for Atlas
    client = new MongoClient(process.env.MONGODB_URI);
    
    // Connect to MongoDB Atlas
    await client.connect();
    
    // Get database instance
    db = client.db();
    
    console.log(`✅ MongoDB Atlas Connected to: ${db.databaseName}`);
    
    // Create indexes for better performance
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

// Create indexes for better query performance
const createIndexes = async () => {
  try {
    const usersCollection = db.collection('users');
    
    // Create unique index on email (prevents duplicate emails)
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    // Create index on createdAt for faster sorting
    await usersCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
};

// Get database instance
const getDB = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return db;
};

// Get users collection
const getUsersCollection = () => {
  return getDB().collection('users');
};

// Get tokens collection
const getTokensCollection = () => {
  return getDB().collection('tokens');
};

// Close database connection
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
  closeDB 
};