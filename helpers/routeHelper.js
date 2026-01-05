const formatRoutes = (routes) => {
  const formattedRoutes = {};
  
  Object.keys(routes).forEach(path => {
    const methods = Object.keys(routes[path]);
    formattedRoutes[path] = methods;
  });

  // Add parameterized routes
  formattedRoutes['/stock/:param'] = ['GET'];

  return formattedRoutes;
};

module.exports = {
  formatRoutes
};

