-- CreateTable
CREATE TABLE "reddit_posts_content" (
    "id" SERIAL NOT NULL,
    "redditPostId" INTEGER NOT NULL,
    "postContent" JSONB NOT NULL,
    "comments" JSONB NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reddit_posts_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reddit_posts_content_redditPostId_key" ON "reddit_posts_content"("redditPostId");

-- AddForeignKey
ALTER TABLE "reddit_posts_content" ADD CONSTRAINT "reddit_posts_content_redditPostId_fkey" FOREIGN KEY ("redditPostId") REFERENCES "reddit_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
