const { BaseScraper } = require('../utils');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

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

const scrapeRedditPostContent = async () => {
  try {
    // Calculate the time 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Query posts where scrapedAt is null OR more than 10 minutes old - just get the first one
    const postsToScrape = await prisma.redditPost.findMany({
      where: {
        OR: [
          { scrapedAt: null },
          { scrapedAt: { lt: tenMinutesAgo } }
        ]
      },
      take: 1
    });
    
    if (postsToScrape.length === 0) {
      console.log('No posts to scrape');
      return;
    }
    
    const post = postsToScrape[0];
    console.log(`\nScraping post: ${post.url}`);
    
    try {
      // Step 1: Extract post_id and subreddit from HTML
      const htmlData = await redditScraper.scrapeWithPage(post.url, async (page) => {
        await page.waitForSelector('body', { timeout: 10000 });
        await sleep(2000);
        
        const data = await page.evaluate(() => {
          // Find the shreddit-post element
          const postElement = document.querySelector('shreddit-post');
          
          if (!postElement) {
            return { post_id: null, subreddit: null };
          }
          
          // Extract post_id (t3_xxx) from id attribute
          const postId = postElement.getAttribute('id') || '';
          
          // Extract subreddit from subreddit-prefixed-name attribute
          const subreddit = postElement.getAttribute('subreddit-prefixed-name') || 
                          postElement.getAttribute('subreddit-name') || '';
          
          return {
            post_id: postId,
            subreddit: subreddit
          };
        });
        
        return data;
      });
      
      if (!htmlData.post_id) {
        console.error('Could not extract post_id from HTML');
        return;
      }
      
      // Step 2: Fetch comments from Reddit JSON API
      const jsonUrl = post.url.endsWith('/') ? `${post.url}.json` : `${post.url}/.json`;
      
      const jsonResponse = await axios.get(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Reddit JSON API returns an array: [post_data, comments_data]
      const postDataJson = jsonResponse.data[0]?.data?.children[0]?.data;
      const commentsData = jsonResponse.data[1]?.data?.children || [];
      
      // Extract post data from JSON
      const postData = {
        post_id: htmlData.post_id,
        subreddit: htmlData.subreddit,
        title: postDataJson?.title || '',
        url: postDataJson?.url || post.url,
        author: postDataJson?.author || '',
        score: postDataJson?.score || 0,
        created_utc: postDataJson?.created_utc || null,
        num_comments: postDataJson?.num_comments || 0,
        selftext: postDataJson?.selftext || '' // Post body/content
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
      
      const allComments = extractAllComments(commentsData, htmlData.post_id);
      
      // Build the result object
      const result = {
        post: postData,
        comments: allComments
      };
      
      // Console log the result as JSON
      console.log(JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error(`Error scraping post ${post.url}:`, error);
      throw error;
    }
    
  } catch (error) {
    console.error('Error in scrapeRedditPostContent:', error);
    throw error;
  }
}

module.exports = {
  searchRedditStock,
  scrapeRedditPostContent
};

