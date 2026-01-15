# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (with hot reload)
npm run dev

# Production
npm start

# Database migrations
npx prisma migrate dev          # Create and apply migrations
npx prisma generate            # Regenerate Prisma Client
npx prisma db push             # Push schema changes without migration
```

## Architecture

This is a Node.js/Express backend that scrapes Reddit for stock-related posts, stores them in PostgreSQL, and analyzes comment sentiment using OpenAI.

### Project Structure

```
config/           # Configuration modules
  database.js     # Prisma singleton (centralized DB connection)
  openai.js       # OpenAI client setup
  redditScraper.js # Scraper intervals & limits
  scheduler.js    # Cron job schedules
  index.js        # Aggregates all config exports

controllers/      # HTTP request handlers
  healthController.js
  stockController.js

routes/           # Route definitions
  health.js
  stock.js
  index.js        # Aggregates all routes

services/         # Business logic layer
  healthService.js
  stockService.js    # Stock search (Finnhub) & Reddit post discovery
  redditService.js   # Reddit API scraping (posts & comments)
  sentimentService.js # OpenAI sentiment analysis
  index.js           # Aggregates all services

jobs/             # Scheduled cron jobs
  redditScraperJob.js
  sentimentAnalysisJob.js
  index.js

utils/            # Utility functions
  routeHelper.js
  index.js

scripts/          # Manual run scripts
  runRedditScraper.js     # Manually trigger scraping
  runSentimentAnalysis.js # Manually trigger sentiment analysis
```

### Core Flow

1. **Stock Lookup** (`GET /stock/:param`) - Searches Reddit for posts mentioning a stock symbol, saves discovered posts to database, then triggers content scraping
2. **Reddit Scraper Job** - Cron job (every 5 min) that scrapes post content and comments using age-based intervals (more frequent for newer posts)
3. **Sentiment Analysis Job** - Cron job (every 1 min) that sends unanalyzed comments to OpenAI for sentiment scoring (-1 to 1)

### Key Patterns

**Route Registration**: Routes are registered dynamically in `server.js` by iterating over route objects that map paths to method handlers. Parameterized routes (like `/stock/:param`) are registered separately.

**Age-Based Scraping**: Posts are scraped at different intervals based on age (config in `config/redditScraper.js`):
- < 1 day old: every 10 minutes
- 1-3 days old: every hour
- 3-7 days old: once per day
- > 7 days old: never

**Comment Filtering**: Only comments with score >= 2 or <= -2, and body length >= 10 characters are saved.

**Sentiment Scoring**: Uses GPT-4o-mini with a deterministic scoring system. Base score (-0.9 to +0.9) modified by keyword presence (+/-0.02 each, max +/-0.10) and vote count (+/-0.02 to 0.08).

### Database Schema (Prisma/PostgreSQL)

- `Stock` - Stock symbols with metadata
- `RedditPost` - Discovered posts linked to stocks
- `RedditPostContent` - Full post content (JSON)
- `RedditComment` - Individual comments with sentiment scores

### Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `FINNHUB_API_KEY` - For stock symbol search
- `OPENAI_API_KEY` - For sentiment analysis

Optional:
- `PORT` - Server port (default: 3000)
- `ENABLE_REDDIT_SCRAPER` - Set to 'false' to disable
- `ENABLE_SENTIMENT_ANALYSIS` - Set to 'false' to disable
