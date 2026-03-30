#!/bin/sh
set -e

# Clone commercial extensions if PAT is available
if [ -n "$GITHUB_PAT" ]; then
  echo "Cloning commercial extensions..."
  git clone https://${GITHUB_PAT}@github.com/mohiteu811-cloud/livaround-commercial.git ../commercial 2>&1 || echo "Commercial clone FAILED"
  echo "Clone done. Checking files:"
  ls -la ../commercial/ 2>&1 || echo "No ../commercial directory"
  ls -la ../commercial/backend-extensions/ 2>&1 || echo "No backend-extensions directory"
  echo "Current dir: $(pwd)"
  echo "PAYMENTS_ENABLED=$PAYMENTS_ENABLED"
else
  echo "No GITHUB_PAT set, skipping commercial clone"
fi

npx prisma db push --accept-data-loss
npx ts-node --compiler-options '{"rootDir":"."}' prisma/seed.ts || echo "seed skipped"
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node -r ts-node/register/transpile-only dist/index.js
