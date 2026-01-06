/*
  Warnings:

  - Added the required column `stockId` to the `reddit_posts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "reddit_posts" ADD COLUMN     "stockId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "reddit_posts" ADD CONSTRAINT "reddit_posts_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
