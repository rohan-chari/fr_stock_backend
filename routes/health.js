const { getHealth } = require('../controllers/healthController');

const healthRoutes = {
  '/health': {
    GET: getHealth
  }
};

module.exports = healthRoutes;

