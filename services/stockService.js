const axios = require('axios');
const { redditHelper } = require('../helpers');

const getStockByParam = async (param) => {
  return await redditHelper.scrapeRedditStock(param);
};

const searchStock = async (query) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY is not set in environment variables');
  }
  
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&exchange=US&token=${apiKey}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'request' }
    });
    
    if (response.status !== 200) {
      throw new Error(`Finnhub API returned status ${response.status}`);
    }
    
    console.log('Finnhub API Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error calling Finnhub API:', error);
    throw error;
  }
};

module.exports = {
  getStockByParam,
  searchStock
};

