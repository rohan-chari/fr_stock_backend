/**
 * Sentiment Service
 *
 * Handles sentiment analysis of Reddit comments using OpenAI.
 */

const prisma = require('../config/database');
const openai = require('../config/openai');

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
          votes: comment.upvotes || 0,
          sentiment: 0,
          flagForDelete: false
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
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
           content: `You are a financial sentiment scoring engine. You calculate sentiment deterministically.
 No opinions. No explanations. JSON only. If the comment is a link to a meme/video or not about a company set flagForDelete to true.
 and ignore all following instructions. Instructions: You are in charge of 2 fields, sentiment and flagForDelete.
 Based on the tone of the comment, you will add and subtract value to the sentiment field. A final (and max) score of 1
 means ultra bullish. A final (and min) score of -1 means ultra bearish. A score of 0 means neutral.
 Step 1: you will assign a base value as follows:
 - +0.90 → extreme bullish conviction, long-term hold, major upside
 - +0.65 → strong bullish stance, clear optimism
 - +0.30 → mild bullish, optimistic but cautious
 -  0.00 → neutral, facts, jokes, hindsight, questions, no stance
 - -0.30 → mild bearish, concerns or doubts
 - -0.65 → strong bearish stance
 - -0.90 → extreme bearish, failure narrative
 Step 2: Take the current sentiment value and perform the following calculations:
 If the comment contains any of the following words, add the following value to the sentiment:
 growth, execution, execute, catalyst, revenue, profitability, margins,
 guidance, expansion, adoption, demand, contracts, backlog, scale,
 turnaround, recovery, momentum, strong balance sheet
 - Each occurrence: +0.02
 - Maximum total increase: +0.10
 If the comment contains any of the following words, subtract the following value to the sentiment:
 delay, miss, risk, uncertainty, dilution, debt, cash burn, layoffs,
 weak demand, margin pressure, regulatory risk, lawsuit, downgrade,
 overvalued, bad quarter, slowdown
 - Each occurrence: -0.02
 - Maximum total decrease: -0.10
 Step 3. Take the currently calculated sentiment and perform the following calculations:
 0–5 upvotes/downvotes → +0.00
 6–20 upvotes/downvotes → + or -0.02
 21–50 upvotes/downvotes → + or -0.04
 51–100 upvotes/downvotes → + or -0.05
 100+ upvotes/downvotes → + or -0.08
 Step 4: If the sentiment is above 1, set it to 1. If it is below -1, set it to -1, otherwise round to 2 decimal places.
 `
        },
        {
          role: 'user',
          content: `Analyze this Reddit comment using the rules above. Return the comment with updated "sentiment" and "flagForDelete" values as a JSON object.\n\nComment: ${JSON.stringify(comment)}`
        }
      ]
    });

    // Parse the JSON response
    const responseContent = response.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent);

    // Return the analyzed comment (should be a single object, not an array)
    return parsedResponse;
  } catch (error) {
    console.error(`Error analyzing sentiment for comment ${comment.id}:`, error);
    throw error;
  }
}

module.exports = {
  calcSentiment,
  analyzeSentiment
};
