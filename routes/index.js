const healthRoutes = require('./health');
const stockRoutes = require('./stock');

const allRoutes = {
  ...healthRoutes,
  ...stockRoutes
};

module.exports = allRoutes;

