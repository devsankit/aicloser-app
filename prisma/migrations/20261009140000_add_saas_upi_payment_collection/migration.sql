CREATE TYPE "UpiPaymentLinkStatus" AS ENUM ('PENDING', 'CUSTOMER_CONFIRMED', 'PAID', 'REJECTED', 'EXPIRED', 'CANCELLED');

CREATE TYPE "UpiPaymentDurationUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');

CREATE TABLE "upi_payment_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "upiId" TEXT,
    "payeeName" TEXT,
    "instructions" TEXT,
    "qrBrandName" TEXT,
    "qrAccentColor" TEXT DEFAULT '#ff5a1f',
    "qrLogoDataUrl" TEXT,
    "screenshotRequired" BOOLEAN NOT NULL DEFAULT true,
    "utrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoActivateOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "durationMultipliers" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "upi_payment_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upi_payment_settings_tenantId_key" ON "upi_payment_settings"("tenantId");
CREATE INDEX "upi_payment_settings_enabled_idx" ON "upi_payment_settings"("enabled");

CREATE TABLE "upi_payment_field_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "surface" TEXT NOT NULL DEFAULT 'CLOSER',
    "reportVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "upi_payment_field_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upi_payment_field_policies_tenantId_fieldKey_key" ON "upi_payment_field_policies"("tenantId", "fieldKey");
CREATE INDEX "upi_payment_field_policies_tenantId_surface_sortOrder_idx" ON "upi_payment_field_policies"("tenantId", "surface", "sortOrder");

CREATE TABLE "upi_payment_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "status" "UpiPaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "duration" INTEGER NOT NULL DEFAULT 1,
    "durationUnit" "UpiPaymentDurationUnit" NOT NULL,
    "durationMultiplier" DECIMAL(8,4) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "upiIdSnapshot" TEXT NOT NULL,
    "payeeNameSnapshot" TEXT NOT NULL,
    "instructionsSnapshot" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "productName" TEXT,
    "packageId" TEXT,
    "customFields" JSONB,
    "customerNote" TEXT,
    "utrReference" TEXT,
    "proofStoragePath" TEXT,
    "proofMimeType" TEXT,
    "proofSizeBytes" INTEGER,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmationNote" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "upi_payment_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upi_payment_links_publicToken_key" ON "upi_payment_links"("publicToken");
CREATE INDEX "upi_payment_links_tenantId_status_createdAt_idx" ON "upi_payment_links"("tenantId", "status", "createdAt");
CREATE INDEX "upi_payment_links_tenantId_createdByUserId_createdAt_idx" ON "upi_payment_links"("tenantId", "createdByUserId", "createdAt");
CREATE INDEX "upi_payment_links_customerUserId_status_idx" ON "upi_payment_links"("customerUserId", "status");

CREATE TABLE "upi_payment_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "upi_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "upi_payment_events_tenantId_createdAt_idx" ON "upi_payment_events"("tenantId", "createdAt");
CREATE INDEX "upi_payment_events_paymentLinkId_createdAt_idx" ON "upi_payment_events"("paymentLinkId", "createdAt");

ALTER TABLE "upi_payment_links" ADD CONSTRAINT "upi_payment_links_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppAuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upi_payment_links" ADD CONSTRAINT "upi_payment_links_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "AppAuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upi_payment_links" ADD CONSTRAINT "upi_payment_links_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "AppAuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upi_payment_links" ADD CONSTRAINT "upi_payment_links_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "AppAuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upi_payment_links" ADD CONSTRAINT "upi_payment_links_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "AppAuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upi_payment_events" ADD CONSTRAINT "upi_payment_events_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "upi_payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upi_payment_events" ADD CONSTRAINT "upi_payment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppAuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
