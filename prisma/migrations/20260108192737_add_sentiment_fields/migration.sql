-- AlterTable
ALTER TABLE "reddit_comments" ADD COLUMN     "flagForDelete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentiment" DOUBLE PRECISION;
