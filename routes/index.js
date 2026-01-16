const healthRoutes = require('./health');
const stockRoutes = require('./stock');
const adminRoutes = require('./admin');

const allRoutes = {
  ...healthRoutes,
  ...stockRoutes,
  ...adminRoutes
};

module.exports = allRoutes;

