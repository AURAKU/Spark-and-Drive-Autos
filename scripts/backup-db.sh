#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups/db"
TIMESTAMP="$(date +"%Y-%m-%d-%H-%M")"
FILENAME="sparkdrive-db-${TIMESTAMP}.sql"
OUT_FILE="$BACKUP_DIR/$FILENAME"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed or not in PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set in the environment." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup..."

node -e '
const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;
const outFile = process.argv[1];

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
  "--no-owner",
  "--no-privileges",
  "-h",
  parsed.hostname,
  "-p",
  parsed.port || "5432",
  "-U",
  decodeURIComponent(parsed.username || ""),
  "-d",
  decodeURIComponent((parsed.pathname || "/").replace(/^\//, "")),
  "-f",
  outFile,
];

const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(parsed.password || ""),
};

const result = spawnSync("pg_dump", args, {
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
' "$OUT_FILE"

echo "Backup created: $OUT_FILE"
