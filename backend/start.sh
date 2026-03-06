#!/bin/sh
npx prisma migrate deploy
npx ts-node prisma/seed.ts
node dist/index.js
