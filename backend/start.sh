#!/bin/sh
set -e
npx prisma db push
npx ts-node prisma/seed.ts || echo "Seed skipped (already seeded or ts-node unavailable)"
node dist/index.js
