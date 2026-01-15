/**
 * Reddit Service
 *
 * Handles all Reddit-related operations including searching for stock-related
 * posts and scraping post content/comments.
 */

const axios = require('axios');
const prisma = require('../config/database');
const { SCRAPE_INTERVALS, MAX_POST_AGE_MS, RATE_LIMIT } = require('../config').redditScraper;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const searchRedditStock = async (param) => {
  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(param)}&type=link&sort=hot`;

    const stockSubbredditSearch = `https://www.reddit.com/search.json?q=${encodeURIComponent(param)} stock official subreddit&type=communities`;

    // Fetch subreddit search results
    try {
      const subredditResponse = await axios.get(stockSubbredditSearch, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      // Extract first subreddit (t5) from the response
      const subredditChildren = subredditResponse.data?.data?.children || [];
      const firstSubreddit = subredditChildren.find(child => child.kind === 't5');

      if (firstSubreddit) {
        console.log('First subreddit:', JSON.stringify(firstSubreddit, null, 2));
      } else {
        console.log('No subreddits found in response');
      }
    } catch (subredditError) {
      console.error('Error fetching subreddit search:', subredditError.message);
    }

    // Rate limit: wait before making another Reddit API call
    await sleep(2000);

    // Fetch JSON directly from Reddit API
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Reddit JSON API returns data in data.children array
    const children = response.data?.data?.children || [];

    // Extract posts (kind === 't3' is a post/link)
    const posts = [];
    const stockSymbolUpper = param.toUpperCase();

    for (const child of children) {
      if (child.kind === 't3') {
        const postData = child.data;

        // Check if post title contains the stock symbol (case-insensitive)
        const title = postData.title || '';
        if (!title.toUpperCase().includes(stockSymbolUpper)) {
          continue; // Skip posts that don't contain the stock symbol
        }

        // Build the full URL
        const permalink = postData.permalink || '';
        const fullUrl = permalink.startsWith('http')
          ? permalink
          : `https://www.reddit.com${permalink}`;

        // Convert created_utc to ISO string
        let postTime = null;
        if (postData.created_utc) {
          postTime = new Date(postData.created_utc * 1000).toISOString();
        }

        posts.push({
          id: postData.name, // e.g., "t3_1q4sfvk"
          title: title,
          url: fullUrl,
          postTime: postTime
        });
      }
    }

    return {
      param,
      stockSymbol: param,
      totalPosts: posts.length,
      posts: posts
    };
  } catch (error) {
    console.error('Error scraping Reddit:', error);
    throw error;
  }
};

/**
 * Determines if a post should be scraped based on its age and last scrape time.
 * Uses age-based intervals from configuration.
 *
 * @param {Object} post - Post object with postTime and scrapedAt properties
 * @returns {boolean} - True if post should be scraped, false otherwise
 */
const shouldScrapePost = (post) => {
  const now = Date.now();
  const postAge = now - post.postTime.getTime();

  // Don't scrape posts older than the maximum age threshold
  if (postAge >= MAX_POST_AGE_MS) {
    return false;
  }

  // If never scraped, always scrape (as long as it's not too old)
  if (!post.scrapedAt) {
    return true;
  }

  // Find the appropriate interval rule based on post age
  const rule = SCRAPE_INTERVALS.find(r => postAge < r.maxAgeMs);
  if (!rule) {
    return false; // Shouldn't happen, but safety check
  }

  // Check if enough time has passed since last scrape
  const timeSinceLastScrape = now - post.scrapedAt.getTime();
  return timeSinceLastScrape >= rule.intervalMs;
};

/**
 * Scrapes a single post's content and comments from Reddit.
 * This is the core scraping logic used by both scheduled and on-demand scraping.
 *
 * @param {Object} post - Post object with id and url
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
const scrapeSinglePost = async (post) => {
  try {
    // Fetch post and comments from Reddit JSON API
    const jsonUrl = post.url.endsWith('/') ? `${post.url}.json` : `${post.url}/.json`;

    const jsonResponse = await axios.get(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Reddit JSON API returns an array: [post_data, comments_data]
    const postDataJson = jsonResponse.data[0]?.data?.children[0]?.data;
    const commentsData = jsonResponse.data[1]?.data?.children || [];

    if (!postDataJson) {
      console.error('Could not extract post data from JSON');
      return false;
    }

    // Extract post data from JSON (all data is available here)
    const postData = {
      post_id: postDataJson.name || '', // e.g., "t3_1q4sfvk"
      subreddit: postDataJson.subreddit_name_prefixed || `r/${postDataJson.subreddit || ''}`,
      title: postDataJson.title || '',
      url: postDataJson.url || post.url,
      author: postDataJson.author || '',
      score: postDataJson.score || 0,
      created_utc: postDataJson.created_utc || null,
      num_comments: postDataJson.num_comments || 0,
      selftext: postDataJson.selftext || '' // Post body/content
    };

    // Recursive function to extract all comments (flattened with parent_id for threading)
    const extractAllComments = (children, postId, parentId = null, depth = 0) => {
      const comments = [];

      for (const child of children) {
        if (child.kind === 't1') { // t1 is a comment
          const commentData = child.data;
          const commentId = commentData.name; // e.g., "t1_nxur05e"

          const comment = {
            comment_id: commentId,
            post_id: postId,
            parent_id: parentId || postId,
            author: commentData.author || '',
            body: commentData.body || '',
            score: commentData.score || 0,
            created_utc: commentData.created_utc || null,
            depth: depth
          };

          comments.push(comment);

          // Recursively extract replies
          if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
            const replies = extractAllComments(commentData.replies.data.children, postId, commentId, depth + 1);
            comments.push(...replies);
          }
        }
      }

      return comments;
    };

    const allComments = extractAllComments(commentsData, postData.post_id);

    // Save to database
    const now = new Date();

    // Upsert the content (create or update if exists)
    await prisma.redditPostContent.upsert({
      where: { redditPostId: post.id },
      update: {
        postContent: postData,
        scrapedAt: now,
        updatedAt: now
      },
      create: {
        redditPostId: post.id,
        postContent: postData,
        scrapedAt: now
      }
    });

    // Save each comment as a separate row in the reddit_comments table
    // Filter: only save comments with (score >= 2 OR score <= -2) AND body length >= 10
    for (const comment of allComments) {
      try {
        const commentScore = comment.score || 0;
        const commentBody = comment.body || '';

        if ((commentScore >= 2 || commentScore <= -2) && commentBody.length >= 10) {
          const createdAtUtc = comment.created_utc
            ? new Date(comment.created_utc * 1000)
            : new Date();

          await prisma.redditComment.upsert({
            where: { redditId: comment.comment_id },
            update: {
              body: commentBody,
              upvotes: commentScore,
              createdAtUtc: createdAtUtc,
              scrapedAt: now
            },
            create: {
              redditId: comment.comment_id,
              redditPostId: post.id,
              body: commentBody,
              upvotes: commentScore,
              createdAtUtc: createdAtUtc,
              scrapedAt: now
            }
          });
        }
      } catch (commentError) {
        console.error(`Error saving comment ${comment.comment_id}:`, commentError);
      }
    }

    // Update scrapedAt in reddit_posts table
    await prisma.redditPost.update({
      where: { id: post.id },
      data: { scrapedAt: now }
    });

    return true;
  } catch (error) {
    console.error(`Error scraping post ${post.url}:`, error);
    return false;
  }
};

/**
 * Scrapes content for all posts that need updating based on age-based rules.
 * Used by the scheduled job.
 */
const scrapeRedditPostContent = async () => {
  try {
    // Get all posts and filter by age-based rules
    const allPosts = await prisma.redditPost.findMany({
      include: {
        content: true
      }
    });

    // Filter posts that should be scraped based on age-based rules
    const postsToScrape = allPosts.filter(shouldScrapePost);

    if (postsToScrape.length === 0) {
      return;
    }

    // Process each post
    for (let i = 0; i < postsToScrape.length; i++) {
      await scrapeSinglePost(postsToScrape[i]);

      // Sleep between posts (random delay within configured rate limit range)
      if (i < postsToScrape.length - 1) {
        const sleepTime = Math.random() * (RATE_LIMIT.MAX_DELAY_MS - RATE_LIMIT.MIN_DELAY_MS) + RATE_LIMIT.MIN_DELAY_MS;
        await sleep(sleepTime);
      }
    }
  } catch (error) {
    console.error('Error in scrapeRedditPostContent:', error);
    throw error;
  }
};

/**
 * Scrapes content for specific posts by their database IDs.
 * Used for on-demand scraping of newly discovered posts.
 *
 * @param {number[]} postIds - Array of database post IDs to scrape
 */
const scrapePostsByIds = async (postIds) => {
  if (!postIds || postIds.length === 0) {
    return;
  }

  try {
    // Fetch posts by IDs
    const posts = await prisma.redditPost.findMany({
      where: {
        id: { in: postIds }
      }
    });

    if (posts.length === 0) {
      return;
    }

    console.log(`Scraping ${posts.length} newly discovered posts...`);

    // Process each post with rate limiting
    for (let i = 0; i < posts.length; i++) {
      await scrapeSinglePost(posts[i]);

      // Sleep between posts
      if (i < posts.length - 1) {
        const sleepTime = Math.random() * (RATE_LIMIT.MAX_DELAY_MS - RATE_LIMIT.MIN_DELAY_MS) + RATE_LIMIT.MIN_DELAY_MS;
        await sleep(sleepTime);
      }
    }
  } catch (error) {
    console.error('Error in scrapePostsByIds:', error);
    throw error;
  }
}

module.exports = {
  searchRedditStock,
  scrapeRedditPostContent,
  scrapePostsByIds
};
