-- Normalize all existing user emails to lowercase.
-- Fixes login failures caused by mixed-case emails stored before the
-- trim().toLowerCase() enforcement was added to the auth routes.
UPDATE "User" SET email = LOWER(email) WHERE email != LOWER(email);
