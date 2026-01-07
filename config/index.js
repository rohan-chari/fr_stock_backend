/**
 * Configuration Module
 * 
 * Centralized configuration exports for the application.
 * This provides a single entry point for all configuration modules.
 */

const redditScraperConfig = require('./redditScraper');
const schedulerConfig = require('./scheduler');

module.exports = {
  redditScraper: redditScraperConfig,
  scheduler: schedulerConfig
};

