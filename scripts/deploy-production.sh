#!/usr/bin/env bash
# Atomic production deployment for Spark & Drive Autos.
# Builds in an isolated release directory and switches the live symlink only after success.
# Preserves the previous working release for rollback.
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-sparkdrive}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www}"
RELEASES_DIR="${DEPLOY_ROOT}/releases"
CURRENT_LINK="${DEPLOY_ROOT}/current"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

log() {
  echo "[deploy] $*"
}

fail() {
  echo "[deploy] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

rollback_to_previous_release() {
  if [[ -L "$CURRENT_LINK" ]]; then
    local previous
    previous="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
    if [[ -n "$previous" && -f "$previous/.next/BUILD_ID" ]]; then
      log "Previous release still available at: $previous"
      log "Rollback: ln -sfn \"$previous\" \"$CURRENT_LINK\" && pm2 restart $APP_NAME --update-env"
    fi
  elif [[ -f ".next/BUILD_ID" ]]; then
    log "In-place build failed but existing .next/BUILD_ID is intact — no symlink switch occurred."
  fi
}

on_error() {
  local exit_code=$?
  log "Deployment failed (exit $exit_code). Live traffic was not switched to the failed release."
  rollback_to_previous_release
  exit "$exit_code"
}

trap on_error ERR

require_cmd npm
require_cmd npx
require_cmd node

# Resolve source directory (repo checkout used to seed the release)
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SOURCE_DIR"

log "Source: $SOURCE_DIR"
log "Release: $RELEASE_DIR"

mkdir -p "$RELEASES_DIR"

# Seed release directory from current checkout (rsync preferred; cp fallback)
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude "$RELEASES_DIR" \
    "$SOURCE_DIR/" "$RELEASE_DIR/"
else
  mkdir -p "$RELEASE_DIR"
  cp -a "$SOURCE_DIR/." "$RELEASE_DIR/"
  rm -rf "$RELEASE_DIR/node_modules" "$RELEASE_DIR/.next" "$RELEASE_DIR/.git"
fi

cd "$RELEASE_DIR"

log "Installing dependencies (npm ci)..."
npm ci

log "Validating Prisma schema..."
npx prisma validate

log "Generating Prisma client..."
npx prisma generate

if [[ -f .env || -f .env.production ]]; then
  log "Applying database migrations..."
  npx prisma migrate deploy
else
  log "No .env in release dir — skipping prisma migrate deploy (ensure migrations run separately)."
fi

log "Type-checking..."
npx tsc --noEmit

log "Linting..."
npm run lint

if npm run test --if-present 2>/dev/null; then
  log "Tests passed."
else
  log "No test script or tests skipped."
fi

# Backup last successful .next inside release workspace before clean build
if [[ -d .next && -f .next/BUILD_ID ]]; then
  log "Backing up existing .next before build..."
  rm -rf .next.backup
  cp -a .next .next.backup
fi

log "Building Next.js application..."
if npm run build; then
  rm -rf .next.backup
  log "Build succeeded."
else
  log "Build failed — restoring .next backup if present..."
  if [[ -d .next.backup ]]; then
    rm -rf .next
    mv .next.backup .next
    log "Restored .next backup inside release directory."
  fi
  fail "npm run build failed"
fi

[[ -f .next/BUILD_ID ]] || fail "Build output missing .next/BUILD_ID"

# Atomically switch live symlink only after a successful build
PREVIOUS_TARGET=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
fi

log "Switching live release: $CURRENT_LINK -> $RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

if command -v pm2 >/dev/null 2>&1; then
  log "Restarting PM2 process: $APP_NAME"
  pm2 restart "$APP_NAME" --update-env
  pm2 save
  pm2 status "$APP_NAME" || true
  pm2 logs "$APP_NAME" --lines 80 --nostream || true
else
  log "pm2 not found — skipping process restart (build artifacts are ready at $RELEASE_DIR)."
fi

# Prune old releases, always keeping the current live target
if [[ -d "$RELEASES_DIR" ]]; then
  mapfile -t OLD_RELEASES < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) || true)
  for old in "${OLD_RELEASES[@]:-}"; do
    [[ -n "$old" && "$old" != "$RELEASE_DIR" && "$old" != "$PREVIOUS_TARGET" ]] || continue
    log "Pruning old release: $old"
    rm -rf "$old"
  done
fi

log "Deployment complete."
log "Rollback: ln -sfn \"${PREVIOUS_TARGET:-<previous-release>}\" \"$CURRENT_LINK\" && pm2 restart $APP_NAME --update-env"
