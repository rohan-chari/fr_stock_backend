const { getStock } = require('../controllers/stockController');

const stockRoutes = {
  '/stock': {
    GET: getStock
  }
};

module.exports = stockRoutes;

