require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());

// Middleware to parse JSON (if needed in future)
app.use(express.json());

// Register routes
Object.keys(routes).forEach(path => {
  const route = routes[path];
  Object.keys(route).forEach(method => {
    app[method.toLowerCase()](path, route[method]);
  });
});

// Handle parameterized route /stock/:param
app.get('/stock/:param', require('./controllers/stockController').getStock);

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, let the server continue running
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
