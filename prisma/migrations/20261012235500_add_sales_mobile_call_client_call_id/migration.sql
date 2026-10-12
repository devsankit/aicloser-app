-- AlterTable
ALTER TABLE "SalesMobileCall" ADD COLUMN "clientCallId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SalesMobileCall_tenantId_agentId_clientCallId_key" ON "SalesMobileCall"("tenantId", "agentId", "clientCallId");

-- CreateIndex
CREATE INDEX "SalesMobileCall_clientCallId_idx" ON "SalesMobileCall"("clientCallId");
