const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Fetches comments from redditComments table in groups of 20
 * @returns {Promise<Array>} Array of comment objects with stock ticker, body, upvotes, sentiment, and flagForDelete
 */
const getRedditPostContent = async () => {
  try {
    // Fetch first 20 comments with their associated post and stock information
    // Only fetch comments where sentToAIAt is null (not yet sent to AI)
    const comments = await prisma.redditComment.findMany({
      where: {
        sentToAIAt: null
      },
      take: 20,
      include: {
        redditPost: {
          include: {
            stock: true
          }
        }
      }
    });

    if (comments.length === 0) {
      console.log('No Reddit comments found in database');
      return [];
    }

    // Create objects with the required structure
    const sentimentData = comments.map(comment => ({
      stockTicker: comment.redditPost?.stock?.symbol || '',
      body: comment.body || '',
      upvotes: comment.upvotes || 0,
      sentiment: 0,
      flagForDelete: false
    }));
    
    console.log(JSON.stringify(sentimentData, null, 2));

    return sentimentData;
  } catch (error) {
    console.error('Error fetching Reddit comments:', error);
    throw error;
  }
};

module.exports = {
  getRedditPostContent
};

