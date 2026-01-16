/**
 * Scheduler Configuration
 * 
 * Defines cron schedules for scheduled jobs.
 * Uses standard cron syntax: minute hour day month weekday
 */

module.exports = {
  /**
   * Reddit post content scraper schedule
   * Runs every 10 minutes to ensure posts are scraped according to their age-based intervals
   *
   * Cron format: minute hour day month weekday
   */
  REDDIT_SCRAPER: {
    schedule: '*/10 * * * *', // Every 10 minutes
    enabled: process.env.ENABLE_REDDIT_SCRAPER !== 'false', // Enabled by default, can be disabled via env var
    timezone: 'America/New_York' // Optional: specify timezone
  },
  /**
   * Sentiment analysis schedule
   * Runs every 5 minutes to analyze Reddit comments for sentiment
   *
   * Cron format: minute hour day month weekday
   */
  SENTIMENT_ANALYSIS: {
    schedule: '*/1 * * * *', // Every 1 minute (cron: */1 * * * *)
    enabled: process.env.ENABLE_SENTIMENT_ANALYSIS !== 'false', // Enabled by default, can be disabled via env var
    timezone: 'America/New_York' // Optional: specify timezone
  },
  /**
   * Official subreddit scraper schedule
   * Runs every 30 minutes to scrape posts from official stock subreddits
   *
   * Cron format: minute hour day month weekday
   */
  SUBREDDIT_SCRAPER: {
    schedule: '*/30 * * * *', // Every 30 minutes
    enabled: process.env.ENABLE_SUBREDDIT_SCRAPER !== 'false', // Enabled by default, can be disabled via env var
    timezone: 'America/New_York' // Optional: specify timezone
  }
};

