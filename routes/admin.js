const { getAllStocks } = require('../controllers/adminController');

const adminRoutes = {
  '/admin/stocks': {
    GET: getAllStocks
  }
};

module.exports = adminRoutes;
