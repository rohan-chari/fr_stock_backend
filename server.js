require('dotenv').config();
const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
