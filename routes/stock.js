const { getStock, searchStock } = require('../controllers/stockController');

const stockRoutes = {
  '/stock': {
    GET: getStock
  },
  '/stock/search': {
    GET: searchStock
  }
};

module.exports = stockRoutes;

