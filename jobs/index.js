/**
 * Scheduled Jobs Module
 *
 * Centralized exports for all scheduled jobs.
 * Provides a single entry point for job management.
 */

const redditScraperJob = require('./redditScraperJob');
const sentimentAnalysisJob = require('./sentimentAnalysisJob');
const subredditScraperJob = require('./subredditScraperJob');

/**
 * Starts all scheduled jobs
 */
const startAllJobs = () => {
  redditScraperJob.startRedditScraperJob();
  sentimentAnalysisJob.startSentimentAnalysisJob();
  subredditScraperJob.startSubredditScraperJob();
};

/**
 * Stops all scheduled jobs
 */
const stopAllJobs = () => {
  redditScraperJob.stopRedditScraperJob();
  sentimentAnalysisJob.stopSentimentAnalysisJob();
  subredditScraperJob.stopSubredditScraperJob();
};

/**
 * Gets status of all jobs
 */
const getAllJobsStatus = () => {
  return {
    redditScraper: redditScraperJob.getJobStatus(),
    sentimentAnalysis: sentimentAnalysisJob.getJobStatus(),
    subredditScraper: subredditScraperJob.getJobStatus()
  };
};

module.exports = {
  startAllJobs,
  stopAllJobs,
  getAllJobsStatus,
  redditScraperJob,
  sentimentAnalysisJob,
  subredditScraperJob
};

