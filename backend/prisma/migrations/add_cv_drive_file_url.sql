-- Manual migration: add CandidateProfile.cvDriveFileUrl
-- Stores the link to the copy of the CV template that the app saved into the user's
-- own Google Drive (via the "save to my Drive" flow), so the "view in Drive" action
-- is always available without re-saving. Distinct from cvCopyUrl (the user's own
-- edited copy link).
-- Applied via `prisma db execute` (see add_role_and_impersonation.sql for context).

ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "cvDriveFileUrl" TEXT;
