/**
 * Scheduled Jobs Module
 * 
 * Centralized exports for all scheduled jobs.
 * Provides a single entry point for job management.
 */

const redditScraperJob = require('./redditScraperJob');

/**
 * Starts all scheduled jobs
 */
const startAllJobs = () => {
  redditScraperJob.startRedditScraperJob();
};

/**
 * Stops all scheduled jobs
 */
const stopAllJobs = () => {
  redditScraperJob.stopRedditScraperJob();
};

/**
 * Gets status of all jobs
 */
const getAllJobsStatus = () => {
  return {
    redditScraper: redditScraperJob.getJobStatus()
  };
};

module.exports = {
  startAllJobs,
  stopAllJobs,
  getAllJobsStatus,
  redditScraperJob
};

