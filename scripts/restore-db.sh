#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed or not in PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set in the environment." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/restore-db.sh <backup-file.sql>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Warning: NODE_ENV=production detected."
fi

echo "Restore target is DATABASE_URL (credentials are hidden)."
echo "Backup file: $BACKUP_FILE"
echo "This will overwrite data in the target database."
read -r -p "Type RESTORE to continue: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 0
fi

echo "Restoring database..."

node -e '
const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;
const backupFile = process.argv[1];

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error("Error: DATABASE_URL is not a valid URL.");
  process.exit(1);
}

if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
  console.error("Error: DATABASE_URL must be a PostgreSQL URL.");
  process.exit(1);
}

const args = [
  "-v",
  "ON_ERROR_STOP=1",
  "-h",
  parsed.hostname,
  "-p",
  parsed.port || "5432",
  "-U",
  decodeURIComponent(parsed.username || ""),
  "-d",
  decodeURIComponent((parsed.pathname || "/").replace(/^\//, "")),
  "-f",
  backupFile,
];

const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(parsed.password || ""),
};

const result = spawnSync("psql", args, {
  env,
  stdio: ["ignore", "inherit", "inherit"],
});

if (result.error) {
  console.error(`Error: ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === "number" && result.status !== 0) {
  process.exit(result.status);
}
' "$BACKUP_FILE"

echo "Restore completed."
