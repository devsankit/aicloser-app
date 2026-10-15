-- Expected recording route by phone family. Observed capability remains on
-- SalesMobileDevice so telemetry can distinguish the configured route from
-- what the device actually reported.
CREATE TABLE "SalesMobileRecordingProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "modelPattern" TEXT NOT NULL,
    "dialerPackage" TEXT,
    "recordingCapability" TEXT NOT NULL,
    "automationMode" TEXT NOT NULL DEFAULT 'AUTO_SHARE',
    "requiresAccessibility" BOOLEAN NOT NULL DEFAULT false,
    "requiresFolderAccess" BOOLEAN NOT NULL DEFAULT false,
    "userActionRequired" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "instructions" JSONB,
    "limitations" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesMobileRecordingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesMobileRecordingProfile_key_key" ON "SalesMobileRecordingProfile"("key");
CREATE INDEX "SalesMobileRecordingProfile_manufacturer_isActive_idx" ON "SalesMobileRecordingProfile"("manufacturer", "isActive");
CREATE INDEX "SalesMobileRecordingProfile_modelPattern_isActive_idx" ON "SalesMobileRecordingProfile"("modelPattern", "isActive");

ALTER TABLE "SalesMobileDevice"
    ADD COLUMN "dialerPackage" TEXT,
    ADD COLUMN "recordingProfileId" TEXT;

CREATE INDEX "SalesMobileDevice_recordingProfileId_idx" ON "SalesMobileDevice"("recordingProfileId");
ALTER TABLE "SalesMobileDevice"
    ADD CONSTRAINT "SalesMobileDevice_recordingProfileId_fkey"
    FOREIGN KEY ("recordingProfileId") REFERENCES "SalesMobileRecordingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SalesMobileRecordingProfile" (
    "id", "key", "manufacturer", "modelPattern", "dialerPackage",
    "recordingCapability", "automationMode", "requiresAccessibility",
    "requiresFolderAccess", "userActionRequired", "title", "instructions",
    "limitations", "priority", "updatedAt"
) VALUES
(
    'mobile-recording-profile-google-pixel-9',
    'google-pixel-9-google-phone',
    'Google', 'Pixel 9', 'com.google.android.dialer',
    'DIALER_SHARE', 'MANUAL_SHARE', false, false, true,
    'Google Phone manual share',
    '["Phone recordings stay private inside Google Phone.", "Open the completed call, tap Share recording, and choose AI Closer.", "AI Closer matches the audio to the nearest CRM call automatically."]'::jsonb,
    'Recording availability depends on country, carrier, and Google Phone policy.',
    100, CURRENT_TIMESTAMP
),
(
    'mobile-recording-profile-xiaomi-redmi-9',
    'xiaomi-redmi-9-miui',
    'Xiaomi', 'Redmi 9', 'com.miui.contacts',
    'DIALER_SHARE', 'MANUAL_SHARE', false, false, true,
    'Xiaomi dialer manual share',
    '["Open the completed dialer call.", "Tap Share recording and choose AI Closer.", "The shared audio is matched and uploaded automatically."]'::jsonb,
    'MIUI may not expose dialer recordings through normal shared storage.',
    100, CURRENT_TIMESTAMP
),
(
    'mobile-recording-profile-xiaomi-default',
    'xiaomi-default-share',
    'Xiaomi', '*', NULL,
    'DIALER_SHARE', 'MANUAL_SHARE', false, false, true,
    'Xiaomi dialer manual share',
    '["Open the native call details.", "Tap Share recording and choose AI Closer.", "AI Closer imports the shared audio automatically."]'::jsonb,
    'The exact Phone package and recording availability vary by MIUI build.',
    50, CURRENT_TIMESTAMP
),
(
    'mobile-recording-profile-samsung-default',
    'samsung-default-folder',
    'Samsung', '*', NULL,
    'SYSTEM_FOLDER_OR_MEDIASTORE', 'SYSTEM_IMPORT', false, false, false,
    'Samsung recording folder import',
    '["Samsung Phone saves the recording to a system media location.", "AI Closer discovers and uploads the new audio automatically."]'::jsonb,
    'Folder visibility depends on Samsung Phone and Android storage policy.',
    50, CURRENT_TIMESTAMP
),
(
    'mobile-recording-profile-default',
    'default-auto-share',
    '*', '*', NULL,
    'DIALER_SHARE', 'MANUAL_SHARE', false, false, true,
    'Native dialer manual share',
    '["Open the native call details after a completed call.", "Tap Share recording and choose AI Closer.", "AI Closer imports and uploads the audio automatically."]'::jsonb,
    'The native dialer must expose a completed recording and Share action.',
    0, CURRENT_TIMESTAMP
);
