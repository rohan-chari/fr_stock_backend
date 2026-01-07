require('dotenv').config();
const { getRedditPostContent } = require('../helpers/sentimentHelper');

const runTest = async () => {
  try {
    console.log('Testing sentimentHelper - fetching Reddit post content...\n');
    
    const postContent = await getRedditPostContent();
    console.log(postContent);
    console.log('\nTest completed');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

runTest();

