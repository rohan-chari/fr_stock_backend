/**
 * Scheduled Jobs Module
 * 
 * Centralized exports for all scheduled jobs.
 * Provides a single entry point for job management.
 */

const redditScraperJob = require('./redditScraperJob');
const sentimentAnalysisJob = require('./sentimentAnalysisJob');

/**
 * Starts all scheduled jobs
 */
const startAllJobs = () => {
  redditScraperJob.startRedditScraperJob();
  sentimentAnalysisJob.startSentimentAnalysisJob();
};

/**
 * Stops all scheduled jobs
 */
const stopAllJobs = () => {
  redditScraperJob.stopRedditScraperJob();
  sentimentAnalysisJob.stopSentimentAnalysisJob();
};

/**
 * Gets status of all jobs
 */
const getAllJobsStatus = () => {
  return {
    redditScraper: redditScraperJob.getJobStatus(),
    sentimentAnalysis: sentimentAnalysisJob.getJobStatus()
  };
};

module.exports = {
  startAllJobs,
  stopAllJobs,
  getAllJobsStatus,
  redditScraperJob,
  sentimentAnalysisJob
};

