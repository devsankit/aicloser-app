ALTER TABLE "AppAuthUser" DROP CONSTRAINT IF EXISTS "AppAuthUser_phone_key";

ALTER TABLE "AppAuthUser" ALTER COLUMN "phone" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AppAuthUser_phone_key" ON "AppAuthUser"("phone");
