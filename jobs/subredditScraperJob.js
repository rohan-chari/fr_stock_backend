/**
 * Subreddit Scraper Scheduled Job
 *
 * Scheduled job that scrapes posts from official stock subreddits at configured intervals.
 * Handles errors gracefully and provides logging.
 * Uses a lock flag to prevent concurrent executions.
 */

const cron = require('node-cron');
const { scrapeAllOfficialSubreddits } = require('../services/redditService');
const schedulerConfig = require('../config/scheduler');

let job = null;
let isRunning = false; // Lock flag to prevent concurrent executions

/**
 * Starts the subreddit scraper cron job
 * @returns {Object|null} The cron job instance, or null if disabled
 */
const startSubredditScraperJob = () => {
  const config = schedulerConfig.SUBREDDIT_SCRAPER;

  if (!config.enabled) {
    console.log('Subreddit scraper job is disabled');
    return null;
  }

  console.log(`Starting subreddit scraper job with schedule: ${config.schedule}`);

  // Create cron job with error handling and lock flag
  job = cron.schedule(
    config.schedule,
    async () => {
      // Check if job is already running
      if (isRunning) {
        console.log(`[${new Date().toISOString()}] Subreddit scraper job skipped - previous job still running`);
        return;
      }

      // Set lock flag
      isRunning = true;
      const startTime = new Date();
      console.log(`\n[${startTime.toISOString()}] Subreddit scraper job started`);

      try {
        await scrapeAllOfficialSubreddits();
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[${endTime.toISOString()}] Subreddit scraper job completed in ${duration}s\n`);
      } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Subreddit scraper job failed:`, error);
        // Don't throw - let the job continue running for next iteration
      } finally {
        // Always release lock flag, even if error occurred
        isRunning = false;
      }
    },
    {
      scheduled: true,
      timezone: config.timezone || undefined
    }
  );

  return job;
};

/**
 * Stops the subreddit scraper cron job
 */
const stopSubredditScraperJob = () => {
  if (job) {
    job.stop();
    console.log('Subreddit scraper job stopped');
    job = null;
    isRunning = false;
  }
};

/**
 * Gets the current status of the job
 * @returns {Object} Job status information
 */
const getJobStatus = () => {
  return {
    running: isRunning,
    schedule: schedulerConfig.SUBREDDIT_SCRAPER.schedule,
    enabled: schedulerConfig.SUBREDDIT_SCRAPER.enabled
  };
};

module.exports = {
  startSubredditScraperJob,
  stopSubredditScraperJob,
  getJobStatus
};
