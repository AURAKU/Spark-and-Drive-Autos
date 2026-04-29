#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date +"%Y-%m-%d-%H-%M-%S")"
DEST="$ROOT_DIR/backups/full-${STAMP}"

mkdir -p "$DEST"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Spark & Drive Autos — full project backup"
echo "  Destination: $DEST"
echo "══════════════════════════════════════════════════════════════"
echo ""

have_pg_dump=0
if command -v pg_dump >/dev/null 2>&1; then
  have_pg_dump=1
fi

if [[ -n "${DATABASE_URL:-}" ]] && [[ "$have_pg_dump" -eq 1 ]]; then
  export BACKUP_SQL_PATH="$DEST/database.sql"
  bash "$ROOT_DIR/scripts/backup-db.sh"
  unset BACKUP_SQL_PATH
  echo "  ✓ Database dump → database.sql"
elif [[ -z "${DATABASE_URL:-}" ]]; then
  echo "  ⚠ DATABASE_URL not set — skipped database (load .env or export DATABASE_URL)."
else
  echo "  ⚠ pg_dump not installed — skipped database (install Postgres client tools)."
fi

if git rev-parse --git-dir >/dev/null 2>&1; then
  git rev-parse HEAD 2>/dev/null >"$DEST/git-HEAD.txt" || true
  {
    echo "=== git status ==="
    git status -sb 2>/dev/null || true
    echo ""
    echo "=== last commit ==="
    git log -1 --oneline 2>/dev/null || true
  } >"$DEST/git-summary.txt" || true

  if git bundle create "$DEST/repository.bundle" --all 2>/dev/null; then
    echo "  ✓ Git bundle → repository.bundle (restore: git clone repo.bundle my-checkout)"
  else
    echo "  ⚠ git bundle --all failed (often shallow clones); writing HEAD archive instead."
    git archive --format=tar.gz -o "$DEST/source-HEAD.tar.gz" HEAD 2>/dev/null && echo "  ✓ Git archive → source-HEAD.tar.gz" || true
  fi
else
  echo "  ⚠ Not a git repository — skipped code bundle."
fi

if [[ -f .env ]]; then
  cp .env "$DEST/env.copy.BACKUP_SENSITIVE"
  chmod 600 "$DEST/env.copy.BACKUP_SENSITIVE" 2>/dev/null || true
  echo "  ✓ Env copy → env.copy.BACKUP_SENSITIVE (private; delete after use)"
fi

cat >"$DEST/README.txt" <<EOF
Spark & Drive Autos — backup ${STAMP}
Directory: ${DEST}

Contents:
- database.sql           PostgreSQL plain SQL dump (pg_restore/psql compatible), if DB backup ran.
- repository.bundle      Full git repository (git clone foo.bundle restored-repo).
- source-HEAD.tar.gz     Present only if bundle failed; snapshot of current HEAD tree.
- git-HEAD.txt / git-summary.txt — revision and status at backup time.
- env.copy.BACKUP_SENSITIVE — copy of .env; treat as secret.

Restore database (example):
  psql "\$DATABASE_URL" -f database.sql

Restore from bundle:
  git clone "$DEST/repository.bundle" spark-drive-restored
EOF

echo ""
echo "Backup complete."
echo "Location: $DEST"
echo ""
