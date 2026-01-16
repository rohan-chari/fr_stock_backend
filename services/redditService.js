/**
 * Reddit Service
 *
 * Handles all Reddit-related operations including searching for stock-related
 * posts and scraping post content/comments.
 */

const axios = require('axios');
const prisma = require('../config/database');
const { SCRAPE_INTERVALS, MAX_POST_AGE_MS, RATE_LIMIT } = require('../config').redditScraper;
const { withLogging, SERVICES } = require('../utils/apiLogger');
const { getNextProxyAgent, markProxyFailed } = require('../utils/proxyManager');

/**
 * Masks credentials in a proxy URL for safe logging.
 * @param {string|null} proxyUrl - The proxy URL
 * @returns {string|null} - Masked proxy URL or null
 */
const maskProxyUrl = (proxyUrl) => {
  if (!proxyUrl) return null;
  return proxyUrl.replace(/:([^:@]+)@/, ':***@');
};

/**
 * Checks if an error indicates a proxy failure (connection/network issue)
 * vs an application-level error (like Reddit returning 403).
 * Only network errors should mark the proxy as failed.
 */
const isProxyError = (error) => {
  // Network/connection errors that indicate proxy failure
  const proxyErrorCodes = [
    'ECONNREFUSED',     // Connection refused
    'ECONNRESET',       // Connection reset
    'ETIMEDOUT',        // Connection timed out
    'ENOTFOUND',        // DNS lookup failed
    'ENETUNREACH',      // Network unreachable
    'EHOSTUNREACH',     // Host unreachable
    'EPROTO',           // Protocol error
    'EPIPE',            // Broken pipe
    'ERR_SOCKET_CLOSED' // Socket closed
  ];

  if (error.code && proxyErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for proxy authentication errors
  if (error.response?.status === 407) {
    return true; // Proxy authentication required
  }

  // HTTP errors from the target server (like 403 from Reddit) are NOT proxy errors
  return false;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const searchRedditStock = async (param) => {
  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(param)}&type=link&sort=hot`;

    const stockSubbredditSearch = `https://www.reddit.com/search.json?q=${encodeURIComponent(param)} stock official subreddit&type=communities`;

    // Fetch subreddit search results
    let proxy1 = null;
    try {
      const proxyResult1 = getNextProxyAgent();
      const agent1 = proxyResult1?.agent || null;
      proxy1 = proxyResult1?.proxyUrl || null;
      const subredditResponse = await withLogging(
        SERVICES.REDDIT,
        () => axios.get(stockSubbredditSearch, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          httpsAgent: agent1,
          httpAgent: agent1
        }),
        {
          endpoint: '/search.json (communities)',
          method: 'GET',
          requestSummary: `Search subreddits for ${param}`,
          getResponseSummary: (res) => `Found ${res.data?.data?.children?.length || 0} communities`,
          proxyUsed: maskProxyUrl(proxy1)
        }
      );
      // Extract first subreddit (t5) from the response
      const subredditChildren = subredditResponse.data?.data?.children || [];
      const firstSubreddit = subredditChildren.find(child => child.kind === 't5');

      if (firstSubreddit) {
        console.log('First subreddit:', JSON.stringify(firstSubreddit, null, 2));
      } else {
        console.log('No subreddits found in response');
      }
    } catch (subredditError) {
      if (proxy1 && isProxyError(subredditError)) markProxyFailed(proxy1);
      console.error('Error fetching subreddit search:', subredditError.message);
    }

    // Rate limit: wait before making another Reddit API call
    await sleep(1000);

    // Fetch JSON directly from Reddit API
    const proxyResult2 = getNextProxyAgent();
    const agent2 = proxyResult2?.agent || null;
    const proxy2 = proxyResult2?.proxyUrl || null;
    let response;
    try {
      response = await withLogging(
        SERVICES.REDDIT,
        () => axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          httpsAgent: agent2,
          httpAgent: agent2
        }),
        {
          endpoint: '/search.json (posts)',
          method: 'GET',
          requestSummary: `Search posts for ${param}`,
          getResponseSummary: (res) => `Found ${res.data?.data?.children?.length || 0} posts`,
          proxyUsed: maskProxyUrl(proxy2)
        }
      );
    } catch (searchError) {
      if (proxy2 && isProxyError(searchError)) markProxyFailed(proxy2);
      throw searchError;
    }

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
  const proxyResult = getNextProxyAgent();
  const agent = proxyResult?.agent || null;
  const proxyUrl = proxyResult?.proxyUrl || null;

  try {
    // Fetch post and comments from Reddit JSON API
    const jsonUrl = post.url.endsWith('/') ? `${post.url}.json` : `${post.url}/.json`;

    const jsonResponse = await withLogging(
      SERVICES.REDDIT,
      () => axios.get(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        httpsAgent: agent,
        httpAgent: agent
      }),
      {
        endpoint: `${post.redditId || 'post'}/.json`,
        method: 'GET',
        requestSummary: `Scrape post ${post.redditId || post.id}`,
        getResponseSummary: (res) => {
          const comments = res.data?.[1]?.data?.children?.length || 0;
          return `Post scraped with ${comments} top-level comments`;
        },
        proxyUsed: maskProxyUrl(proxyUrl)
      }
    );

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
    if (proxyUrl && isProxyError(error)) markProxyFailed(proxyUrl);
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

/**
 * Scrapes posts from a specific subreddit (for official stock subreddits).
 * Fetches hot posts from the past 7 days, excluding stickied posts.
 *
 * @param {string} subredditName - Name of the subreddit (without r/ prefix)
 * @param {number} stockId - Database ID of the stock
 * @param {number} limit - Maximum number of posts to fetch (default 25)
 * @returns {Promise<number[]>} - Array of newly created post IDs
 */
const scrapeSubredditPosts = async (subredditName, stockId, limit = 25) => {
  const proxyResult = getNextProxyAgent();
  const agent = proxyResult?.agent || null;
  const proxyUrl = proxyResult?.proxyUrl || null;

  try {
    const subredditUrl = `https://www.reddit.com/r/${encodeURIComponent(subredditName)}/hot.json?limit=${limit}`;

    const response = await withLogging(
      SERVICES.REDDIT,
      () => axios.get(subredditUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        httpsAgent: agent,
        httpAgent: agent
      }),
      {
        endpoint: `/r/${subredditName}/hot.json`,
        method: 'GET',
        requestSummary: `Fetch hot posts from r/${subredditName}`,
        getResponseSummary: (res) => `Found ${res.data?.data?.children?.length || 0} posts`,
        proxyUsed: maskProxyUrl(proxyUrl)
      }
    );

    const children = response.data?.data?.children || [];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newPostIds = [];

    for (const child of children) {
      if (child.kind !== 't3') continue;

      const postData = child.data;

      // Skip stickied posts
      if (postData.stickied) continue;

      // Skip posts older than 7 days
      const postTime = postData.created_utc ? postData.created_utc * 1000 : 0;
      if (postTime < sevenDaysAgo) continue;

      const redditId = postData.name; // e.g., "t3_xxxxx"
      const permalink = postData.permalink || '';
      const fullUrl = permalink.startsWith('http')
        ? permalink
        : `https://www.reddit.com${permalink}`;

      // Upsert the post (deduplication via redditId unique constraint)
      try {
        const existing = await prisma.redditPost.findUnique({
          where: { redditId }
        });

        if (existing) {
          // Update existing post (don't change source if already set)
          await prisma.redditPost.update({
            where: { redditId },
            data: {
              url: fullUrl,
              postTime: new Date(postTime)
            }
          });
        } else {
          // Create new post with source = 'subreddit'
          const created = await prisma.redditPost.create({
            data: {
              redditId,
              url: fullUrl,
              postTime: new Date(postTime),
              stockId,
              source: 'subreddit'
            }
          });
          newPostIds.push(created.id);
        }
      } catch (error) {
        console.error(`Error saving subreddit post ${redditId}:`, error.message);
      }
    }

    console.log(`[Subreddit r/${subredditName}] Found ${children.length} posts, saved ${newPostIds.length} new posts`);
    return newPostIds;
  } catch (error) {
    if (proxyUrl && isProxyError(error)) markProxyFailed(proxyUrl);
    console.error(`Error scraping subreddit r/${subredditName}:`, error.message);
    return [];
  }
};

/**
 * Scrapes posts from all stocks that have an official subreddit configured.
 * Used by the scheduled cron job.
 *
 * @returns {Promise<void>}
 */
const scrapeAllOfficialSubreddits = async () => {
  try {
    // Find all stocks with officialSubreddit set
    const stocksWithSubreddits = await prisma.stock.findMany({
      where: {
        officialSubreddit: { not: null }
      }
    });

    if (stocksWithSubreddits.length === 0) {
      console.log('[Subreddit Scraper] No stocks with official subreddits configured');
      return;
    }

    console.log(`[Subreddit Scraper] Scraping ${stocksWithSubreddits.length} official subreddits...`);

    for (let i = 0; i < stocksWithSubreddits.length; i++) {
      const stock = stocksWithSubreddits[i];

      console.log(`[Subreddit Scraper] Scraping r/${stock.officialSubreddit} for ${stock.symbol}...`);

      const newPostIds = await scrapeSubredditPosts(stock.officialSubreddit, stock.id);

      // Scrape content for new posts
      if (newPostIds.length > 0) {
        await scrapePostsByIds(newPostIds);
      }

      // Rate limit between subreddits
      if (i < stocksWithSubreddits.length - 1) {
        const sleepTime = Math.random() * (RATE_LIMIT.MAX_DELAY_MS - RATE_LIMIT.MIN_DELAY_MS) + RATE_LIMIT.MIN_DELAY_MS;
        await sleep(sleepTime);
      }
    }

    console.log('[Subreddit Scraper] Completed scraping all official subreddits');
  } catch (error) {
    console.error('[Subreddit Scraper] Error:', error);
    throw error;
  }
};

module.exports = {
  searchRedditStock,
  scrapeRedditPostContent,
  scrapePostsByIds,
  scrapeSubredditPosts,
  scrapeAllOfficialSubreddits
};
