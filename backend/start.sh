#!/bin/sh
set -e

# Clone commercial extensions if PAT is available
if [ -n "$GITHUB_PAT" ]; then
  echo "Cloning commercial extensions..."
  git clone https://${GITHUB_PAT}@github.com/mohiteu811-cloud/livaround-commercial.git ../commercial 2>&1 || echo "Commercial clone FAILED"
  # Symlink node_modules so commercial code can resolve backend dependencies
  ln -s /app/node_modules ../commercial/backend-extensions/node_modules 2>/dev/null || true
  ln -s /app/node_modules ../commercial/node_modules 2>/dev/null || true
else
  echo "No GITHUB_PAT set, skipping commercial clone"
fi

npx prisma db push --accept-data-loss
npx ts-node --compiler-options '{"rootDir":"."}' prisma/seed.ts || echo "seed skipped"
node prisma/seed-contacts.js || echo "seed-contacts skipped"
node -r ts-node/register/transpile-only dist/index.js
