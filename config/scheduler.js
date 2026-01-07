/**
 * Scheduler Configuration
 * 
 * Defines cron schedules for scheduled jobs.
 * Uses standard cron syntax: minute hour day month weekday
 */

module.exports = {
  /**
   * Reddit post content scraper schedule
   * Runs every 5 minutes to ensure posts are scraped according to their age-based intervals
   * 
   * Cron format: minute hour day month weekday
   */
  REDDIT_SCRAPER: {
    schedule: '*/5 * * * *', // Every 5 minutes (cron: */5 * * * *)
    enabled: process.env.ENABLE_REDDIT_SCRAPER !== 'false', // Enabled by default, can be disabled via env var
    timezone: 'America/New_York' // Optional: specify timezone
  }
};

