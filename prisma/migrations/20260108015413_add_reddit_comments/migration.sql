/*
  Warnings:

  - You are about to drop the column `comments` on the `reddit_posts_content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reddit_posts_content" DROP COLUMN "comments";

-- CreateTable
CREATE TABLE "reddit_comments" (
    "id" SERIAL NOT NULL,
    "redditId" TEXT NOT NULL,
    "redditPostId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToAIAt" TIMESTAMP(3),

    CONSTRAINT "reddit_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reddit_comments_redditId_key" ON "reddit_comments"("redditId");

-- CreateIndex
CREATE INDEX "reddit_comments_redditPostId_idx" ON "reddit_comments"("redditPostId");

-- AddForeignKey
ALTER TABLE "reddit_comments" ADD CONSTRAINT "reddit_comments_redditPostId_fkey" FOREIGN KEY ("redditPostId") REFERENCES "reddit_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
