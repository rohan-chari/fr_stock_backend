const { BaseScraper } = require('../utils');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { SCRAPE_INTERVALS, MAX_POST_AGE_MS, RATE_LIMIT } = require('../config').redditScraper;

const prisma = new PrismaClient();
const redditScraper = new BaseScraper({
  baseURL: 'https://www.reddit.com',
  headless: false
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const searchRedditStock = async (param) => {
  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(param)}&type=link&sort=hot`;
    
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

const scrapeRedditPostContent = async () => {
  try {
    // Get all posts and filter by age-based rules
    const allPosts = await prisma.redditPost.findMany({
      include: {
        content: true // Include content relation to check if exists
      }
    });
    
    // Filter posts that should be scraped based on age-based rules
    const postsToScrape = allPosts.filter(shouldScrapePost);
    
    if (postsToScrape.length === 0) {
      console.log('No posts to scrape');
      return;
    }
    
    console.log(`Found ${postsToScrape.length} posts to scrape\n`);
    
    // Process each post
    for (let i = 0; i < postsToScrape.length; i++) {
      const post = postsToScrape[i];
      console.log(`\n[${i + 1}/${postsToScrape.length}] Scraping post: ${post.url}`);
      
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
          continue; // Skip to next post
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
                parent_id: parentId || postId, // parent_id is the parent comment or post
                author: commentData.author || '',
                body: commentData.body || '',
                score: commentData.score || 0,
                created_utc: commentData.created_utc || null,
                depth: depth
              };
              
              comments.push(comment);
              
              // Recursively extract replies (use this comment as parent)
              if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
                const replies = extractAllComments(commentData.replies.data.children, postId, commentId, depth + 1);
                comments.push(...replies);
              }
            }
          }
          
          return comments;
        };
        
        const allComments = extractAllComments(commentsData, postData.post_id);
        
        // Build the result object
        const result = {
          post: postData,
          comments: allComments
        };
        
        // Save to database
        const now = new Date();
        
        // Upsert the content (create or update if exists)
        await prisma.redditPostContent.upsert({
          where: { redditPostId: post.id },
          update: {
            postContent: postData,
            comments: allComments,
            scrapedAt: now,
            updatedAt: now
          },
          create: {
            redditPostId: post.id,
            postContent: postData,
            comments: allComments,
            scrapedAt: now
          }
        });
        
        // Update scrapedAt in reddit_posts table
        await prisma.redditPost.update({
          where: { id: post.id },
          data: { scrapedAt: now }
        });
        
        console.log(`Saved content for post ${post.redditId}`);
        console.log(`Post content saved, ${allComments.length} comments saved`);
        
        // Console log the result as JSON
        console.log(JSON.stringify(result, null, 2));
        
        // Sleep between posts (random delay within configured rate limit range)
        if (i < postsToScrape.length - 1) {
          const sleepTime = Math.random() * (RATE_LIMIT.MAX_DELAY_MS - RATE_LIMIT.MIN_DELAY_MS) + RATE_LIMIT.MIN_DELAY_MS;
          console.log(`\nWaiting ${(sleepTime / 1000).toFixed(2)} seconds before next post...`);
          await sleep(sleepTime);
        }
        
      } catch (error) {
        console.error(`Error scraping post ${post.url}:`, error);
        // Continue to next post instead of throwing
        continue;
      }
    }
    
    console.log(`\nCompleted scraping ${postsToScrape.length} posts`);
    
  } catch (error) {
    console.error('Error in scrapeRedditPostContent:', error);
    throw error;
  }
}

module.exports = {
  searchRedditStock,
  scrapeRedditPostContent
};

