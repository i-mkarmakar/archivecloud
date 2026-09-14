#!/bin/sh
set -e

if [ -d ./prisma/migrations ] && ls ./prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  echo "Running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "No Prisma migrations found; skipping migrate deploy."
fi

HOSTNAME="${HOSTNAME:-0.0.0.0}" PORT="${PORT:-9050}" exec node server.js
