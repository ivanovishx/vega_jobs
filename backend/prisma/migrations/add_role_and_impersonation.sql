-- Manual migration: add Role enum, User.role, and ImpersonationLog table
-- Applied directly via `prisma db execute` because `prisma db push` would attempt
-- to drop unrelated tables (CompanyCareersPage, CompanyScrapeQueue, JobListings,
-- Test_company_careersTrue) that exist in the DB but are not modeled in schema.prisma.

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';

CREATE TABLE IF NOT EXISTS "ImpersonationLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ImpersonationLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
