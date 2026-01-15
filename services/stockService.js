const axios = require('axios');
const prisma = require('../config/database');
const { searchRedditStock, scrapePostsByIds } = require('./redditService');

/**
 * Formats posts from database into API response format
 */
const formatPostsResponse = (param, posts) => {
  return {
    param,
    stockSymbol: param,
    totalPosts: posts.length,
    posts: posts.map(post => ({
      id: post.redditId,
      title: post.content?.postContent?.title || '',
      url: post.url,
      postTime: post.postTime.toISOString()
    }))
  };
};

/**
 * Background refresh: searches Reddit and scrapes new posts without blocking
 */
const refreshStockInBackground = (param, stock) => {
  // Fire and forget - don't await
  (async () => {
    try {
      console.log(`[Background] Starting refresh for ${param}...`);
      const result = await searchRedditStock(param);

      if (result && result.posts && Array.isArray(result.posts)) {
        const newPostIds = [];

        for (const post of result.posts) {
          if (post.id && post.url && post.postTime) {
            const existing = await prisma.redditPost.findUnique({
              where: { redditId: post.id }
            });

            if (existing) {
              await prisma.redditPost.update({
                where: { redditId: post.id },
                data: {
                  url: post.url,
                  postTime: new Date(post.postTime),
                  stockId: stock.id
                }
              });
            } else {
              const created = await prisma.redditPost.create({
                data: {
                  redditId: post.id,
                  url: post.url,
                  postTime: new Date(post.postTime),
                  stockId: stock.id
                }
              });
              newPostIds.push(created.id);
            }
          }
        }

        // Scrape new posts in background (also non-blocking)
        if (newPostIds.length > 0) {
          scrapePostsByIds(newPostIds).catch(err =>
            console.error(`[Background] Scrape failed for ${param}:`, err.message)
          );
        }
      }
      console.log(`[Background] Refresh complete for ${param}`);
    } catch (error) {
      console.error(`[Background] Refresh failed for ${param}:`, error.message);
    }
  })();
};

const getStockByParam = async (param) => {
  // Find or create the stock in the database first
  let stock = null;
  if (param) {
    try {
      stock = await prisma.stock.findUnique({
        where: { symbol: param.toUpperCase() }
      });

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

  if (!stock) {
    return { param, stockSymbol: param, totalPosts: 0, posts: [] };
  }

  // Check if we have existing posts with content - if so, return immediately
  const existingPosts = await prisma.redditPost.findMany({
    where: { stockId: stock.id },
    include: { content: true },
    orderBy: { postTime: 'desc' }
  });

  const hasScrapedContent = existingPosts.some(p => p.content);

  if (hasScrapedContent) {
    // Return existing data immediately, refresh in background
    console.log(`[${param}] Returning cached data, refreshing in background...`);
    refreshStockInBackground(param, stock);
    return formatPostsResponse(param, existingPosts);
  }

  // No existing data - first-ever lookup, wait for Reddit search
  console.log(`[${param}] First lookup, searching Reddit...`);
  const result = await searchRedditStock(param);

  // Save posts to database
  if (result && result.posts && Array.isArray(result.posts)) {
    const newPostIds = [];

    for (const post of result.posts) {
      try {
        if (post.id && post.url && post.postTime) {
          const existing = await prisma.redditPost.findUnique({
            where: { redditId: post.id }
          });

          if (existing) {
            await prisma.redditPost.update({
              where: { redditId: post.id },
              data: {
                url: post.url,
                postTime: new Date(post.postTime),
                stockId: stock.id
              }
            });
          } else {
            const created = await prisma.redditPost.create({
              data: {
                redditId: post.id,
                url: post.url,
                postTime: new Date(post.postTime),
                stockId: stock.id
              }
            });
            newPostIds.push(created.id);
          }
        }
      } catch (error) {
        console.error(`Error saving Reddit post ${post.id}:`, error.message);
      }
    }

    // Scrape content in background - don't block response
    if (newPostIds.length > 0) {
      console.log(`[${param}] Scraping ${newPostIds.length} posts in background...`);
      scrapePostsByIds(newPostIds).catch(err =>
        console.error(`[Background] Scrape failed for ${param}:`, err.message)
      );
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

