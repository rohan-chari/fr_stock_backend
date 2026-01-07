const { scrapeRedditPostContent } = require('../helpers/redditHelper');

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

