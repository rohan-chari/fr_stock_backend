-- CreateTable
CREATE TABLE "external_services" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_api_logs" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "requestSummary" TEXT,
    "responseSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_services_name_key" ON "external_services"("name");

-- CreateIndex
CREATE INDEX "external_api_logs_serviceId_idx" ON "external_api_logs"("serviceId");

-- CreateIndex
CREATE INDEX "external_api_logs_requestedAt_idx" ON "external_api_logs"("requestedAt");

-- AddForeignKey
ALTER TABLE "external_api_logs" ADD CONSTRAINT "external_api_logs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "external_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
