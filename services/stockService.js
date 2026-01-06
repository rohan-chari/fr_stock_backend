const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { redditHelper } = require('../helpers');

const prisma = new PrismaClient();

const getStockByParam = async (param) => {
  const result = await redditHelper.searchRedditStock(param);
  
  // Find or create the stock in the database
  let stock = null;
  if (param) {
    try {
      stock = await prisma.stock.findUnique({
        where: { symbol: param.toUpperCase() }
      });
      
      // If stock doesn't exist, create it
      if (!stock) {
        stock = await prisma.stock.create({
          data: {
            symbol: param.toUpperCase(),
            description: '',
            displaySymbol: param.toUpperCase(),
            type: ''
          }
        });
      }
    } catch (error) {
      console.error(`Error finding/creating stock ${param}:`, error.message);
    }
  }
  
  // Save posts to database
  if (result && result.posts && Array.isArray(result.posts) && stock) {
    for (const post of result.posts) {
      try {
        // Only save if we have required fields
        if (post.id && post.url && post.postTime) {
          await prisma.redditPost.upsert({
            where: { redditId: post.id },
            update: {
              url: post.url,
              postTime: new Date(post.postTime),
              stockId: stock.id
            },
            create: {
              redditId: post.id,
              url: post.url,
              postTime: new Date(post.postTime),
              stockId: stock.id
            }
          });
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error(`Error saving Reddit post ${post.id} to database:`, error.message);
      }
    }
  }
  
  return result;
};

const searchStock = async (query) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  
  // Step 1: Query Finnhub API and save new stocks to database
  if (apiKey) {
    try {
      const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&exchange=US&token=${apiKey}`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'request' }
      });
      
      if (response.status === 200 && response.data && response.data.result && Array.isArray(response.data.result)) {
        
        // Save results to database if they don't exist
        for (const stock of response.data.result) {
          try {
            await prisma.stock.upsert({
              where: { symbol: stock.symbol },
              update: {
                description: stock.description,
                displaySymbol: stock.displaySymbol,
                type: stock.type
              },
              create: {
                symbol: stock.symbol,
                description: stock.description,
                displaySymbol: stock.displaySymbol,
                type: stock.type
              }
            });
          } catch (error) {
            // Log error but don't fail the request
            console.error(`Error saving stock ${stock.symbol} to database:`, error.message);
          }
        }
      }
    } catch (error) {
      // Log Finnhub error but continue with database search
      console.error('Error calling Finnhub API (continuing with DB search):', error.message);
    }
  }
  
  // Step 2: Query database for matching stocks (bubble search)
  try {
    const searchQuery = query.trim();
    
    if (!searchQuery) {
      // Return empty result if query is empty
      return {
        count: 0,
        result: []
      };
    }
    
    // Use case-insensitive search across multiple fields
    const dbResults = await prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: searchQuery, mode: 'insensitive' } },
          { displaySymbol: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { type: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      orderBy: [
        // Sort by symbol for consistent ordering
        { symbol: 'asc' }
      ],
      take: 100 // Limit results
    });
    
    // Sort results to prioritize exact matches and symbol matches
    const sortedResults = dbResults.sort((a, b) => {
      const queryUpper = searchQuery.toUpperCase();
      const aSymbolUpper = a.symbol.toUpperCase();
      const bSymbolUpper = b.symbol.toUpperCase();
      
      // Prioritize exact symbol matches
      if (aSymbolUpper === queryUpper && bSymbolUpper !== queryUpper) return -1;
      if (bSymbolUpper === queryUpper && aSymbolUpper !== queryUpper) return 1;
      
      // Then prioritize symbol starts with query
      if (aSymbolUpper.startsWith(queryUpper) && !bSymbolUpper.startsWith(queryUpper)) return -1;
      if (bSymbolUpper.startsWith(queryUpper) && !aSymbolUpper.startsWith(queryUpper)) return 1;
      
      // Then prioritize displaySymbol matches
      const aDisplayUpper = a.displaySymbol.toUpperCase();
      const bDisplayUpper = b.displaySymbol.toUpperCase();
      if (aDisplayUpper.includes(queryUpper) && !bDisplayUpper.includes(queryUpper)) return -1;
      if (bDisplayUpper.includes(queryUpper) && !aDisplayUpper.includes(queryUpper)) return 1;
      
      return 0;
    });
    
    // Format response to match Finnhub API structure
    const formattedResults = sortedResults.map(stock => ({
      description: stock.description || '',
      displaySymbol: stock.displaySymbol || stock.symbol,
      symbol: stock.symbol,
      type: stock.type || ''
    }));
    
    return {
      count: formattedResults.length,
      result: formattedResults
    };
  } catch (error) {
    console.error('Error querying database:', error);
    // Return empty result instead of throwing to prevent server crash
    return {
      count: 0,
      result: []
    };
  }
};

module.exports = {
  getStockByParam,
  searchStock
};

