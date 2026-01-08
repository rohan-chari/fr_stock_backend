require('dotenv').config();
const { calcSentiment } = require('../helpers/sentimentHelper');

const runTest = async () => {
  try {
    console.log('Testing sentimentHelper - fetching Reddit post content...\n');
    
    const postContent = await calcSentiment();
    console.log('\nTest completed');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

runTest();

