const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Gets a single Reddit post content record from the database
 * @returns {Promise<Object|null>} A single RedditPostContent record or null if none found
 */
const getRedditPostContent = async () => {
  try {
    const postContent = await prisma.redditPostContent.findFirst({
      include: {
        redditPost: {
          include: {
            stock: true
          }
        }
      }
    });

    if (!postContent) {
      console.log('No Reddit post content found in database');
      return null;
    }
    
    // Organize data for sentiment analysis
    const sentimentData = {
      post: {
        body: postContent.postContent?.selftext || '',
        upvotes: postContent.postContent?.score || 0,
        sentiment: 0
      },
      comments: (postContent.comments || []).map(comment => ({
        body: comment.body || '',
        upvotes: comment.score || 0,
        sentiment: 0
      }))
    };
    
    console.log(JSON.stringify(sentimentData, null, 2));

    return postContent;
  } catch (error) {
    console.error('Error fetching Reddit post content:', error);
    throw error;
  }
};

module.exports = {
  getRedditPostContent
};

