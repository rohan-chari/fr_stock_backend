/**
 * Reddit Scraper Configuration
 * 
 * Defines scraping intervals and age thresholds for Reddit posts.
 * Posts are scraped more frequently when they're newer, and less frequently as they age.
 */

// Time constants for better readability
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Scraping interval rules based on post age.
 * Rules are evaluated in order - first matching rule applies.
 * 
 * @type {Array<{maxAgeMs: number, intervalMs: number, description: string}>}
 */
const SCRAPE_INTERVALS = [
  {
    maxAgeMs: MS_PER_DAY,                    // < 1 day
    intervalMs: 10 * MS_PER_MINUTE,          // every 10 minutes
    description: 'Posts less than 1 day old'
  },
  {
    maxAgeMs: 3 * MS_PER_DAY,                // 1-3 days
    intervalMs: MS_PER_HOUR,                // every hour
    description: 'Posts 1-3 days old'
  },
  {
    maxAgeMs: 7 * MS_PER_DAY,                // 3-7 days
    intervalMs: MS_PER_DAY,                  // once per day
    description: 'Posts 3-7 days old'
  }
];

/**
 * Maximum age (in milliseconds) for posts to be scraped.
 * Posts older than this threshold will never be scraped.
 */
const MAX_POST_AGE_MS = 7 * MS_PER_DAY;

/**
 * Sleep delay configuration for rate limiting between scrapes
 */
const RATE_LIMIT = {
  MIN_DELAY_MS: MS_PER_SECOND,              // 1 second
  MAX_DELAY_MS: 3 * MS_PER_SECOND            // 3 seconds
};

module.exports = {
  SCRAPE_INTERVALS,
  MAX_POST_AGE_MS,
  RATE_LIMIT,
  // Export time constants for potential reuse
  TIME: {
    MS_PER_SECOND,
    MS_PER_MINUTE,
    MS_PER_HOUR,
    MS_PER_DAY
  }
};

