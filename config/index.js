/**
 * Configuration Module
 *
 * Centralized configuration exports for the application.
 * This provides a single entry point for all configuration modules.
 */

const redditScraperConfig = require('./redditScraper');
const schedulerConfig = require('./scheduler');
const openai = require('./openai');
const prisma = require('./database');

module.exports = {
  redditScraper: redditScraperConfig,
  scheduler: schedulerConfig,
  openai,
  prisma
};

