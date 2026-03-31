#!/bin/sh
set -e

# Commercial extensions are included in the monorepo under /commercial.
# Feature gating is handled by IS_COMMERCIAL (PAYMENTS_ENABLED env var) and
# the requirePlan() middleware - no separate repo clone needed.

# Symlink node_modules so commercial code can resolve backend dependencies
ln -sf "$(pwd)/node_modules" ../commercial/backend-extensions/node_modules 2>/dev/null || true
ln -sf "$(pwd)/node_modules" ../commercial/node_modules 2>/dev/null || true

npx prisma db push --accept-data-loss
npx ts-node --compiler-options '{"rootDir":"."}' prisma/seed.ts || echo "seed skipped"
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node -r ts-node/register/transpile-only dist/index.js
