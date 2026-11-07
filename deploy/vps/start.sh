#!/bin/sh
set -e

# 1. Run database migrations/push
echo "Running database migrations..."
pnpm db:push

# Daily campaign statistics from the history (once; a no-op afterwards).
echo "Backfilling campaign statistics..."
pnpm db:backfill-stats

# 2. Run provisioning (creating initial users)
echo "Running provisioning with INITIAL_USERS..."
if [ -z "$INITIAL_USERS" ]; then
  echo "Warning: INITIAL_USERS is not set. No admin users will be created."
else
  pnpm db:provision
fi

# 3. Start the application
echo "Starting Senlo..."
pnpm --filter web start

