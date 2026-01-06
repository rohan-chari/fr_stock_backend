const healthService = require('../services/healthService');

const getHealth = (req, res) => {
  const result = healthService.getHealthStatus();
  res.json(result);
};

module.exports = {
  getHealth
};

