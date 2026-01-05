const stockService = require('../services/stockService');

const getStock = async (req, res) => {
  try {
    const param = req.param;
    const result = await stockService.getStockByParam(param);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error('Error in getStock:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
};

module.exports = {
  getStock
};

