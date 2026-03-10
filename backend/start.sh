#!/bin/sh
set -e
npx prisma db push --accept-data-loss
npx ts-node prisma/seed.ts || echo "Seed skipped (already seeded or ts-node unavailable)"
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node dist/index.js
