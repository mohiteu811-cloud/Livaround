#!/bin/sh
set -e
npx prisma migrate deploy
npx ts-node prisma/seed.ts || echo "Seed skipped (ts-node unavailable or already seeded)"
node dist/index.js
