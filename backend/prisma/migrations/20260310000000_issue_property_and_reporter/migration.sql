-- Add propertyId and reportedById to Issue table (columns exist in Prisma schema but were missing from DB)
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "reportedById" TEXT;

-- Back-fill propertyId from the related Job where possible
UPDATE "Issue" i
SET "propertyId" = j."propertyId"
FROM "Job" j
WHERE i."jobId" = j.id
  AND i."propertyId" IS NULL;

-- Foreign key constraints
ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_propertyId_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_reportedById_fkey";
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
