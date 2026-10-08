CREATE TABLE IF NOT EXISTS "AppGoogleIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "googleSubject" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppGoogleIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppGoogleIdentity_googleSubject_key" ON "AppGoogleIdentity"("googleSubject");
CREATE INDEX IF NOT EXISTS "AppGoogleIdentity_userId_idx" ON "AppGoogleIdentity"("userId");
CREATE INDEX IF NOT EXISTS "AppGoogleIdentity_email_idx" ON "AppGoogleIdentity"("email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AppGoogleIdentity_userId_fkey'
  ) THEN
    ALTER TABLE "AppGoogleIdentity"
      ADD CONSTRAINT "AppGoogleIdentity_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "AppAuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
