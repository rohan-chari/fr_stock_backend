/**
 * Manual Subreddit Scraper Script
 *
 * Run this script to manually trigger scraping of official stock subreddits.
 * Usage: node scripts/runSubredditScraper.js
 */

require('dotenv').config();
const { scrapeAllOfficialSubreddits } = require('../services/redditService');

// Run the scraping function
console.log('Starting subreddit scraper...\n');

scrapeAllOfficialSubreddits()
  .then(() => {
    console.log('\nScraping completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running scraper:', error);
    process.exit(1);
  });
