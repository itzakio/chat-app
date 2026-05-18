const app = require('./src/app');
const { initializeSocket } = require('./src/socket');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Initialize Socket.IO
const io = initializeSocket(server);
console.log('🔌 Socket.IO initialized');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  server.close(() => process.exit(1));
});