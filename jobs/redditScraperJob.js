/**
 * Reddit Scraper Scheduled Job
 * 
 * Scheduled job that runs scrapeRedditPostContent at configured intervals.
 * Handles errors gracefully and provides logging.
 */

const cron = require('node-cron');
const { scrapeRedditPostContent } = require('../helpers/redditHelper');
const schedulerConfig = require('../config/scheduler');

let job = null;

/**
 * Starts the Reddit scraper cron job
 * @returns {Object|null} The cron job instance, or null if disabled
 */
const startRedditScraperJob = () => {
  const config = schedulerConfig.REDDIT_SCRAPER;
  
  if (!config.enabled) {
    console.log('Reddit scraper job is disabled');
    return null;
  }

  console.log(`Starting Reddit scraper job with schedule: ${config.schedule}`);
  
  // Create cron job with error handling
  job = cron.schedule(
    config.schedule,
    async () => {
      const startTime = new Date();
      console.log(`\n[${startTime.toISOString()}] Reddit scraper job started`);
      
      try {
        await scrapeRedditPostContent();
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[${endTime.toISOString()}] Reddit scraper job completed in ${duration}s\n`);
      } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Reddit scraper job failed:`, error);
        // Don't throw - let the job continue running for next iteration
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
 * Stops the Reddit scraper cron job
 */
const stopRedditScraperJob = () => {
  if (job) {
    job.stop();
    console.log('Reddit scraper job stopped');
    job = null;
  }
};

/**
 * Gets the current status of the job
 * @returns {Object} Job status information
 */
const getJobStatus = () => {
  return {
    running: job !== null && job.running !== undefined ? job.running : false,
    schedule: schedulerConfig.REDDIT_SCRAPER.schedule,
    enabled: schedulerConfig.REDDIT_SCRAPER.enabled
  };
};

module.exports = {
  startRedditScraperJob,
  stopRedditScraperJob,
  getJobStatus
};

