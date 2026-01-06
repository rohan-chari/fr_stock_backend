-- CreateTable
CREATE TABLE "reddit_posts" (
    "id" SERIAL NOT NULL,
    "redditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "postTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reddit_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reddit_posts_redditId_key" ON "reddit_posts"("redditId");
