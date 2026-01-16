/**
 * Sentiment Service
 *
 * Handles sentiment analysis of Reddit comments using OpenAI.
 */

const prisma = require('../config/database');
const openai = require('../config/openai');
const { logApiRequest, SERVICES } = require('../utils/apiLogger');

/**
 * Calculates sentiment for Reddit comments
 * Fetches comments from redditComments table and analyzes their sentiment
 * @returns {Promise<Array>} Array of comment objects with stock ticker, body, upvotes, sentiment, and flagForDelete
 */
const calcSentiment = async () => {
  try {
    // Fetch ALL comments that haven't been analyzed yet
    // Only fetch comments where sentToAIAt is null (not yet sent to AI)
    const comments = await prisma.redditComment.findMany({
      where: {
        sentToAIAt: null
      },
      include: {
        redditPost: {
          include: {
            stock: true
          }
        }
      }
    });

    if (comments.length === 0) {
      return [];
    }

    const analyzedComments = [];

    // Process each comment individually
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];

      try {
        // Create object with the required structure
        const commentData = {
          id: comment.id,
          redditId: comment.redditId,
          stockTicker: comment.redditPost?.stock?.symbol || '',
          body: comment.body || '',
          votes: comment.upvotes || 0
        };

        // Analyze single comment
        const analyzedComment = await analyzeSentiment(commentData);

        if (analyzedComment) {
          analyzedComments.push(analyzedComment);

          // Update database immediately after each analysis
          const now = new Date();
          await prisma.redditComment.update({
            where: { id: comment.id },
            data: {
              sentiment: analyzedComment.sentiment ?? null,
              flagForDelete: analyzedComment.flagForDelete ?? false,
              sentToAIAt: now
            }
          });
        }
      } catch (error) {
        console.error(`Error analyzing comment ${comment.id}:`, error.message);
        // Continue with next comment instead of failing entire batch
        continue;
      }
    }
    return analyzedComments;
  } catch (error) {
    console.error('Error in calcSentiment:', error);
    throw error;
  }
};

async function analyzeSentiment(comment) {
  const requestedAt = new Date();
  let response = null;
  let error = null;

  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a financial sentiment analyzer. Analyze Reddit comments about stocks and return a JSON object.

Score the comment's sentiment toward the stock on a scale from -1 to +1:
- +0.7 to +1.0: Very bullish (strong buy conviction, major upside expected)
- +0.3 to +0.6: Bullish (optimistic, positive outlook)
- -0.2 to +0.2: Neutral (factual, questions, jokes, no clear stance)
- -0.6 to -0.3: Bearish (concerns, doubts, negative outlook)
- -1.0 to -0.7: Very bearish (strong sell conviction, expects failure)

Set flagForDelete to true if the comment is:
- A link to a meme/video
- Not about the stock or company
- Spam or irrelevant

Return JSON only: {"sentiment": <number>, "flagForDelete": <boolean>}`
        },
        {
          role: 'user',
          content: `Stock: ${comment.stockTicker}\nComment: ${comment.body}`
        }
      ]
    });

    // Parse the JSON response
    const responseContent = response.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent);

    // Log successful API call
    const respondedAt = new Date();
    logApiRequest({
      service: SERVICES.OPENAI,
      endpoint: '/chat/completions',
      method: 'POST',
      requestedAt,
      respondedAt,
      statusCode: 200,
      success: true,
      requestSummary: `Sentiment analysis for ${comment.stockTicker} comment`,
      responseSummary: `sentiment=${parsedResponse.sentiment}, flagForDelete=${parsedResponse.flagForDelete}`
    }).catch(() => {}); // Silently ignore logging errors

    // Return the analyzed comment (should be a single object, not an array)
    return parsedResponse;
  } catch (err) {
    error = err;

    // Log failed API call
    const respondedAt = new Date();
    logApiRequest({
      service: SERVICES.OPENAI,
      endpoint: '/chat/completions',
      method: 'POST',
      requestedAt,
      respondedAt,
      statusCode: err.status || null,
      success: false,
      errorMessage: err.message,
      requestSummary: `Sentiment analysis for ${comment.stockTicker} comment`
    }).catch(() => {}); // Silently ignore logging errors

    console.error(`Error analyzing sentiment for comment ${comment.id}:`, err);
    throw err;
  }
}

module.exports = {
  calcSentiment,
  analyzeSentiment
};
