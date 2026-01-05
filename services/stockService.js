const { redditHelper } = require('../helpers');

const getStockByParam = async (param) => {
  return await redditHelper.scrapeRedditStock(param);
};

module.exports = {
  getStockByParam
};

