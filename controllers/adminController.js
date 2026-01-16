const prisma = require('../config/database');

const getAllStocks = async (req, res) => {
  try {
    const stocks = await prisma.stock.findMany({
      include: {
        _count: {
          select: { redditPosts: true }
        }
      },
      orderBy: { symbol: 'asc' }
    });

    const response = {
      stocks: stocks.map(stock => ({
        id: stock.id,
        symbol: stock.symbol,
        description: stock.description,
        displaySymbol: stock.displaySymbol,
        type: stock.type,
        officialSubreddit: stock.officialSubreddit,
        postCount: stock._count.redditPosts,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error in getAllStocks:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

const updateStock = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { officialSubreddit } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    const existingStock = await prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!existingStock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    const updatedStock = await prisma.stock.update({
      where: { symbol: symbol.toUpperCase() },
      data: {
        officialSubreddit: officialSubreddit || null
      }
    });

    res.json({
      symbol: updatedStock.symbol,
      officialSubreddit: updatedStock.officialSubreddit,
      updated: true
    });
  } catch (error) {
    console.error('Error in updateStock:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports = {
  getAllStocks,
  updateStock
};
