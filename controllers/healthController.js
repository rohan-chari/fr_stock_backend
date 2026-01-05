const healthService = require('../services/healthService');

const getHealth = (req, res) => {
  const result = healthService.getHealthStatus();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
};

module.exports = {
  getHealth
};

