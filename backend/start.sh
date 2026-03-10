#!/bin/sh
set -e
npx prisma db push --accept-data-loss
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node dist/index.js
