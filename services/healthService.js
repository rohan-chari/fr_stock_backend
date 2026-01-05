const routes = require('../routes');
const { routeHelper } = require('../helpers');

const getHealthStatus = () => {
  const formattedRoutes = routeHelper.formatRoutes(routes);

  return {
    status: 'ok',
    routes: formattedRoutes
  };
};

module.exports = {
  getHealthStatus
};

