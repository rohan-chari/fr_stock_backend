/**
 * Sentiment Analysis Scheduled Job
 * 
 * Scheduled job that runs sentiment analysis on Reddit comments at configured intervals.
 * Handles errors gracefully and provides logging.
 * Uses a lock flag to prevent concurrent executions.
 */

const cron = require('node-cron');
const { calcSentiment } = require('../services/sentimentService');
const schedulerConfig = require('../config/scheduler');

let job = null;
let isRunning = false; // Lock flag to prevent concurrent executions

/**
 * Starts the sentiment analysis cron job
 * @returns {Object|null} The cron job instance, or null if disabled
 */
const startSentimentAnalysisJob = () => {
  const config = schedulerConfig.SENTIMENT_ANALYSIS;
  
  if (!config.enabled) {
    console.log('Sentiment analysis job is disabled');
    return null;
  }

  console.log(`Starting sentiment analysis job with schedule: ${config.schedule}`);
  
  // Create cron job with error handling and lock flag
  job = cron.schedule(
    config.schedule,
    async () => {
      // Check if job is already running
      if (isRunning) {
        console.log(`[${new Date().toISOString()}] Sentiment analysis job skipped - previous job still running`);
        return;
      }

      // Set lock flag
      isRunning = true;
      const startTime = new Date();
      console.log(`\n[${startTime.toISOString()}] Sentiment analysis job started`);
      
      try {
        await calcSentiment();
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`[${endTime.toISOString()}] Sentiment analysis job completed in ${duration}s\n`);
      } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Sentiment analysis job failed:`, error);
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
 * Stops the sentiment analysis cron job
 */
const stopSentimentAnalysisJob = () => {
  if (job) {
    job.stop();
    console.log('Sentiment analysis job stopped');
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
    schedule: schedulerConfig.SENTIMENT_ANALYSIS.schedule,
    enabled: schedulerConfig.SENTIMENT_ANALYSIS.enabled
  };
};

module.exports = {
  startSentimentAnalysisJob,
  stopSentimentAnalysisJob,
  getJobStatus
};

