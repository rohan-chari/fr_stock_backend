const stockService = require('../services/stockService');

const getStock = async (req, res) => {
  try {
    const param = req.params.param;
    const result = await stockService.getStockByParam(param);
    res.json(result);
  } catch (error) {
    console.error('Error in getStock:', error);
    res.status(500).json({ error: error.message });
  }
};

const searchStock = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || req.query.keywords || '';
    if (!query) {
      res.status(400).json({ error: 'Query parameter is required (q, query, or keywords)' });
      return;
    }
    const result = await stockService.searchStock(query);
    res.json(result);
  } catch (error) {
    console.error('Error in searchStock:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStock,
  searchStock
};

