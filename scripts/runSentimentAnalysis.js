/**
 * Manual Sentiment Analysis Script
 *
 * Run this script to manually trigger sentiment analysis on Reddit comments.
 * Usage: node scripts/runSentimentAnalysis.js
 */

require('dotenv').config();
const { calcSentiment } = require('../services/sentimentService');

const runTest = async () => {
  try {
    console.log('Running sentiment analysis on unprocessed comments...\n');

    const results = await calcSentiment();
    console.log(`\nProcessed ${results.length} comments`);
    console.log('Sentiment analysis completed');
    process.exit(0);
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    process.exit(1);
  }
};

runTest();
