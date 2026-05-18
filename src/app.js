const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes); // NEW

// Home route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'JWT Auth & Chat API with MongoDB Atlas is running',
    version: '2.0.0'
  });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;