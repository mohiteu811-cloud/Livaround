-- Property Operations Guide: areas, docs, contacts
-- Supervisor job audits

CREATE TABLE "PropertyArea" (
  "id"          TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "floor"       TEXT,
  "description" TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyDoc" (
  "id"          TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "areaId"      TEXT,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category"    TEXT NOT NULL DEFAULT 'OTHER',
  "photos"      TEXT NOT NULL DEFAULT '[]',
  "tags"        TEXT NOT NULL DEFAULT '[]',
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyDoc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyContact" (
  "id"         TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "agency"     TEXT NOT NULL,
  "name"       TEXT,
  "phones"     TEXT NOT NULL DEFAULT '[]',
  "company"    TEXT,
  "notes"      TEXT,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobAudit" (
  "id"           TEXT NOT NULL,
  "jobId"        TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "rating"       INTEGER NOT NULL,
  "notes"        TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobAudit_jobId_key" ON "JobAudit"("jobId");

ALTER TABLE "PropertyArea"
  ADD CONSTRAINT "PropertyArea_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyDoc"
  ADD CONSTRAINT "PropertyDoc_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyDoc"
  ADD CONSTRAINT "PropertyDoc_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "PropertyArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PropertyContact"
  ADD CONSTRAINT "PropertyContact_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobAudit"
  ADD CONSTRAINT "JobAudit_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobAudit"
  ADD CONSTRAINT "JobAudit_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
