/**
 * Manual Reddit Scraper Script
 *
 * Run this script to manually trigger Reddit post content scraping.
 * Usage: node scripts/runRedditScraper.js
 */

const { scrapeRedditPostContent } = require('../services/redditService');

// Run the scraping function
scrapeRedditPostContent()
  .then(() => {
    console.log('\nScraping completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running scraper:', error);
    process.exit(1);
  });
