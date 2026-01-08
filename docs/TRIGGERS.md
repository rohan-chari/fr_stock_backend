# Reddit Stock Scraper - Triggers Documentation

## Overview
This system has three main operations: Post Discovery, Post Content Scraping, and Comment Scraping.

---

## 1. Post Discovery (Reddit Search)

**Trigger**: API Endpoint
- **Endpoint**: `GET /stock/:param`
- **Example**: `GET /stock/AAPL`
- **When**: On-demand (manual API call)
- **What it does**: 
  - Searches Reddit for posts containing stock symbol
  - Saves post metadata to `reddit_posts` table
  - Creates/updates stock in `stocks` table
- **Files**: `controllers/stockController.js` → `services/stockService.js` → `helpers/redditHelper.js`

---

## 2. Post Content Scraping

**Trigger**: Scheduled Job
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **When**: Automatic (runs continuously)
- **What it does**:
  - Fetches all posts from `reddit_posts` table
  - Filters posts based on age and last scrape time:
    - Posts < 1 day: scrape every 10 minutes
    - Posts 1-3 days: scrape every hour
    - Posts 3-7 days: scrape once per day
    - Posts > 7 days: never scraped
  - Fetches full post content from Reddit
  - Saves to `reddit_posts_content` table
  - Updates `scrapedAt` timestamp
- **Files**: `jobs/redditScraperJob.js` → `helpers/redditHelper.js`
- **Config**: `config/scheduler.js` (can disable via `ENABLE_REDDIT_SCRAPER=false`)

---

## 3. Comment Scraping

**Trigger**: Same as Post Content Scraping (scheduled job)
- **Schedule**: Every 5 minutes (same job as #2)
- **When**: Automatic (runs with post content scraping)
- **What it does**:
  - Extracts all comments from Reddit post
  - Filters comments before saving:
    - Score must be `>= 2` OR `<= -2`
    - Body length must be `>= 10` characters
  - Saves filtered comments to `reddit_comments` table
- **Files**: Same as Post Content Scraping
- **Note**: Comments are scraped together with post content in the same job

---

## Summary Table

| Operation | Trigger | Frequency | Database Updates |
|-----------|---------|-----------|------------------|
| Post Discovery | API: `GET /stock/:param` | On-demand | `reddit_posts`, `stocks` |
| Post Content | Scheduled Job | Every 5 min | `reddit_posts_content`, `reddit_posts.scrapedAt` |
| Comments | Scheduled Job | Every 5 min | `reddit_comments` (filtered) |

---

## Key Points

- **Post Discovery**: Manual API call only, no automation
- **Content & Comments**: Same automated job, runs every 5 minutes
- **Age Limits**: Posts older than 7 days are never scraped for content/comments
- **Comment Filtering**: Only saves comments with significant engagement (score >= 2 or <= -2) and meaningful length (>= 10 chars)
- **Cascade Deletes**: Deleting a post automatically deletes its content and all comments

