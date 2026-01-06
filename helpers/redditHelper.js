const { BaseScraper } = require('../utils');

const redditScraper = new BaseScraper({
  baseURL: 'https://www.reddit.com',
  headless: false
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const searchRedditStock = async (param) => {
  try {
    const searchUrl = `/search?q=${encodeURIComponent(param)}&type=posts&sort=hot`;
    
    const result = await redditScraper.scrapeWithPage(searchUrl, async (page) => {
      // Wait for content to load
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Scroll down multiple times to load more posts
      const scrollTimes = 5; // Number of times to scroll
      for (let i = 0; i < scrollTimes; i++) {
        // Get current number of posts before scrolling
        const previousPostCount = await page.evaluate(() => {
          return document.querySelectorAll('[data-testid="search-sdui-post"]').length;
        });
        
        // Scroll to bottom of page
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for new content to load
        await sleep(2000);
        
        // Check if new posts loaded
        const currentPostCount = await page.evaluate(() => {
          return document.querySelectorAll('[data-testid="search-sdui-post"]').length;
        });
        
        // If no new posts loaded, break early
        if (currentPostCount === previousPostCount) {
          break;
        }
      }
      
      // Add a final delay to ensure all content is loaded
      await sleep(2000);
      
      // Extract posts that contain the stock symbol
      const data = await page.evaluate((stockSymbol) => {
        const posts = [];
        
        // Find all post containers
        const postElements = document.querySelectorAll('[data-testid="search-sdui-post"]');
        
        postElements.forEach((postEl) => {
          // Check if post title contains the stock symbol (has post-title-query element)
          const titleQuery = postEl.querySelector('[data-testid="post-title-query"]');
          if (!titleQuery) return; // Skip posts without the stock symbol
          
          // Get post title
          const titleElement = postEl.querySelector('[data-testid="post-title-text"]') || 
                              postEl.querySelector('[data-testid="post-title"]');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          // Get post URL
          const titleLink = postEl.querySelector('a[data-testid="post-title"]') || 
                           postEl.querySelector('a[data-testid="post-title-text"]');
          const postUrl = titleLink ? titleLink.getAttribute('href') : '';
          const fullUrl = postUrl.startsWith('http') ? postUrl : `https://www.reddit.com${postUrl}`;
          
          // Get post ID
          const postId = postEl.getAttribute('data-thingid') || '';
          
          // Only include posts with t3_ ID (Reddit post identifier)
          if (!postId.startsWith('t3_')) return;
          
          // Get post datetime from time element's datetime attribute
          const timeElement = postEl.querySelector('time');
          let postTime = null;
          if (timeElement) {
            const datetimeAttr = timeElement.getAttribute('datetime');
            if (datetimeAttr) {
              postTime = new Date(datetimeAttr).toISOString();
            }
          }
          
          posts.push({
            id: postId,
            title: title,
            url: fullUrl,
            postTime: postTime
          });
        });
        
        return {
          stockSymbol: stockSymbol,
          totalPosts: posts.length,
          posts: posts
        };
      }, param);
      console.log(data);
      return data;
    });
    
    return { param, ...result };
  } catch (error) {
    console.error('Error scraping Reddit:', error);
    throw error;
  }
};

module.exports = {
  searchRedditStock
};

