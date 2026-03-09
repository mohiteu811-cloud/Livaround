-- Seed dummy owner accounts (password: owner123)
-- Uses fixed IDs so this migration is idempotent

-- Owner 1: Mohit Lalvani → Villa Sussegad (prop-villa-goa)
INSERT INTO "User" ("id", "email", "password", "name", "phone", "role", "createdAt", "updatedAt")
VALUES (
  'usr-mohit-lalvani-01',
  'mohit@livaround.com',
  '$2a$12$NaVzJPn44bIOZQrfUbpn3ORfRAIMwLiIx0o5gY1rW6C6spwIHoB06',
  'Mohit Lalvani',
  '+91 98201 55678',
  'OWNER',
  NOW(), NOW()
) ON CONFLICT ("email") DO NOTHING;

INSERT INTO "Owner" ("id", "userId", "createdAt", "updatedAt")
VALUES (
  'own-mohit-lalvani-01',
  'usr-mohit-lalvani-01',
  NOW(), NOW()
) ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "PropertyOwnership" ("id", "ownerId", "propertyId", "involvementLevel", "ownershipPercent", "commissionPct", "createdAt", "updatedAt")
VALUES (
  'ownprop-mohit-villa01',
  'own-mohit-lalvani-01',
  'prop-villa-goa',
  'FINANCIAL',
  100,
  20,
  NOW(), NOW()
) ON CONFLICT ("ownerId", "propertyId") DO NOTHING;

-- Owner 2: Priya Desai → Casa Anjuna (prop-cottage-goa)
INSERT INTO "User" ("id", "email", "password", "name", "phone", "role", "createdAt", "updatedAt")
VALUES (
  'usr-priya-desai-0001',
  'priya.desai@livaround.com',
  '$2a$12$NaVzJPn44bIOZQrfUbpn3ORfRAIMwLiIx0o5gY1rW6C6spwIHoB06',
  'Priya Desai',
  '+91 97301 22345',
  'OWNER',
  NOW(), NOW()
) ON CONFLICT ("email") DO NOTHING;

INSERT INTO "Owner" ("id", "userId", "createdAt", "updatedAt")
VALUES (
  'own-priya-desai-0001',
  'usr-priya-desai-0001',
  NOW(), NOW()
) ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "PropertyOwnership" ("id", "ownerId", "propertyId", "involvementLevel", "ownershipPercent", "commissionPct", "createdAt", "updatedAt")
VALUES (
  'ownprop-priya-anjun01',
  'own-priya-desai-0001',
  'prop-cottage-goa',
  'FINANCIAL',
  100,
  20,
  NOW(), NOW()
) ON CONFLICT ("ownerId", "propertyId") DO NOTHING;
