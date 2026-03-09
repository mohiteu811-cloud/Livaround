-- Guest experience fields on Property
ALTER TABLE "Property"
  ADD COLUMN "wifiName"            TEXT,
  ADD COLUMN "wifiPassword"        TEXT,
  ADD COLUMN "mapUrl"              TEXT,
  ADD COLUMN "checkInInstructions" TEXT,
  ADD COLUMN "houseRules"          TEXT;

-- Guest code (short URL token) and lock code on Booking
ALTER TABLE "Booking"
  ADD COLUMN "guestCode" TEXT,
  ADD COLUMN "lockCode"  TEXT;

CREATE UNIQUE INDEX "Booking_guestCode_key" ON "Booking"("guestCode");

-- Back-fill existing bookings with a unique guest code
UPDATE "Booking"
SET "guestCode" = lower(substring(md5(random()::text || "id"), 1, 8))
WHERE "guestCode" IS NULL;
