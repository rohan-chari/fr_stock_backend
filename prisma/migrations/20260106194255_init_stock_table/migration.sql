-- CreateTable
CREATE TABLE "stocks" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displaySymbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stocks_symbol_key" ON "stocks"("symbol");
