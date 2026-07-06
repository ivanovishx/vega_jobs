-- Manual migration: add CandidateProfile.cvCopyUrl
-- Stores the link to the user's own edited copy of the CV template (e.g. a Google
-- Drive / Docs URL) so they can save it once and copy it on demand.
-- Applied via `prisma db execute` (see add_role_and_impersonation.sql for why we
-- avoid `prisma db push` on this database).

ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "cvCopyUrl" TEXT;
