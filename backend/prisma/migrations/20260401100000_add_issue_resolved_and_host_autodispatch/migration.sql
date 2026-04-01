-- Add resolvedAt to Issue
ALTER TABLE "Issue" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Add autoDispatch preference to Host (default true)
ALTER TABLE "Host" ADD COLUMN "autoDispatch" BOOLEAN NOT NULL DEFAULT true;
