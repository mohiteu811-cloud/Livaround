#!/bin/sh
set -e

# Clone commercial extensions if PAT is available
if [ -n "$GITHUB_PAT" ]; then
  echo "Cloning commercial extensions..."
  git clone https://${GITHUB_PAT}@github.com/mohiteu811-cloud/livaround-commercial.git ../commercial 2>/dev/null || echo "Commercial clone failed"
fi

npx prisma db push --accept-data-loss
npx ts-node --compiler-options '{"rootDir":"."}' prisma/seed.ts || echo "seed skipped"
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node -r ts-node/register/transpile-only dist/index.js
