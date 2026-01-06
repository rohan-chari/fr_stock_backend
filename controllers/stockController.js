const stockService = require('../services/stockService');

const getStock = async (req, res) => {
  try {
    const param = req.params.param;
    if (!param) {
      return res.status(400).json({ error: 'Stock parameter is required' });
    }
    const result = await stockService.getStockByParam(param);
    res.json(result);
  } catch (error) {
    console.error('Error in getStock:', error);
    // Return 500 instead of crashing
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

const searchStock = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || req.query.keywords || '';
    if (!query || !query.trim()) {
      return res.status(400).json({ 
        error: 'Query parameter is required (q, query, or keywords)',
        count: 0,
        result: []
      });
    }
    
    const result = await stockService.searchStock(query);
  
    
    // Ensure result has count and result array
    const response = {
      count: result.count || 0,
      result: Array.isArray(result.result) ? result.result : []
    };
    console.log(response);
    res.json(response);
  } catch (error) {
    console.error('Error in searchStock:', error);
    // Return 500 with proper format instead of crashing
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      count: 0,
      result: []
    });
  }
};

module.exports = {
  getStock,
  searchStock
};

