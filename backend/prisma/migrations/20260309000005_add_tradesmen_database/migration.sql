-- Tradesmen database: host-level external tradesperson contacts

CREATE TABLE "Tradesman" (
  "id"        TEXT NOT NULL,
  "hostId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "trade"     TEXT NOT NULL,
  "phones"    TEXT NOT NULL DEFAULT '[]',
  "company"   TEXT,
  "notes"     TEXT,
  "area"      TEXT,
  "email"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tradesman_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradesmanProperty" (
  "id"          TEXT NOT NULL,
  "tradesmanId" TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  CONSTRAINT "TradesmanProperty_pkey" PRIMARY KEY ("id")
);

-- Indexes & constraints
CREATE UNIQUE INDEX "TradesmanProperty_tradesmanId_propertyId_key"
  ON "TradesmanProperty"("tradesmanId", "propertyId");

ALTER TABLE "Tradesman"
  ADD CONSTRAINT "Tradesman_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradesmanProperty"
  ADD CONSTRAINT "TradesmanProperty_tradesmanId_fkey"
  FOREIGN KEY ("tradesmanId") REFERENCES "Tradesman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradesmanProperty"
  ADD CONSTRAINT "TradesmanProperty_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
