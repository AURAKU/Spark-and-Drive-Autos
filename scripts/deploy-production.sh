#!/usr/bin/env bash
# Atomic production deploy for Spark & Drive Autos.
# Builds in an isolated release directory and switches `current` only after success.
# PM2 is restarted only when build, migrations, and validation all pass.
#
# Usage (on VPS):
#   cd /var/www/spark-drive-autos && npm run deploy:production
#
# Optional env:
#   APP_ROOT=/var/www/spark-drive-autos   — repo checkout used as source
#   RELEASES_DIR=/var/www/releases        — timestamped release roots
#   CURRENT_LINK=/var/www/current         — symlink switched after success
#   PM2_APP=sparkdrive                    — PM2 process name to restart
#   SKIP_PM2=1                            — build only, do not restart PM2

set -euo pipefail

APP_ROOT="${APP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/releases}"
CURRENT_LINK="${CURRENT_LINK:-/var/www/current}"
PM2_APP="${PM2_APP:-sparkdrive}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"
PREVIOUS_CURRENT=""
ROLLBACK_NEXT=""

log() {
  printf '[deploy-production] %s\n' "$*"
}

fail() {
  printf '[deploy-production] ERROR: %s\n' "$*" >&2
  exit 1
}

restore_previous_build() {
  if [[ -n "${ROLLBACK_NEXT}" && -d "${ROLLBACK_NEXT}" ]]; then
    log "Restoring previous .next from backup: ${ROLLBACK_NEXT}"
    rm -rf "${APP_ROOT}/.next"
    cp -a "${ROLLBACK_NEXT}" "${APP_ROOT}/.next"
  elif [[ -n "${PREVIOUS_CURRENT}" && -d "${PREVIOUS_CURRENT}/.next" ]]; then
    log "Restoring .next from previous release: ${PREVIOUS_CURRENT}"
    rm -rf "${APP_ROOT}/.next"
    cp -a "${PREVIOUS_CURRENT}/.next" "${APP_ROOT}/.next"
  fi
}

on_error() {
  local exit_code=$?
  log "Deploy failed (exit ${exit_code}). Attempting rollback of working build artifact."
  restore_previous_build
  exit "${exit_code}"
}
trap on_error ERR

if [[ -d "${APP_ROOT}/.next" ]]; then
  ROLLBACK_NEXT="$(mktemp -d /tmp/sparkdrive-next-backup-XXXXXX)"
  log "Backing up current .next to ${ROLLBACK_NEXT}"
  cp -a "${APP_ROOT}/.next" "${ROLLBACK_NEXT}/"
fi

if [[ -L "${CURRENT_LINK}" ]]; then
  PREVIOUS_CURRENT="$(readlink -f "${CURRENT_LINK}" || true)"
fi

log "Installing dependencies in ${APP_ROOT}"
cd "${APP_ROOT}"
npm ci

log "Validating environment"
npm run env:validate:prod

log "Generating Prisma client"
npx prisma validate
npx prisma generate

log "Applying database migrations"
npx prisma migrate deploy

log "Typecheck and lint"
npm run typecheck
npm run lint

if npm run test --if-present; then
  :
else
  fail "Tests failed"
fi

if [[ -d "${RELEASES_DIR}" || "${RELEASES_DIR}" == "/var/www/releases" ]]; then
  mkdir -p "${RELEASES_DIR}"
  log "Building release in ${RELEASE_DIR}"
  rsync -a \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    "${APP_ROOT}/" "${RELEASE_DIR}/"

  cd "${RELEASE_DIR}"
  npm ci
  npx prisma generate
  npm run build

  if [[ ! -f "${RELEASE_DIR}/.next/BUILD_ID" ]]; then
    fail "Build succeeded but .next/BUILD_ID is missing"
  fi

  ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
  log "Switched ${CURRENT_LINK} -> ${RELEASE_DIR}"

  rm -rf "${APP_ROOT}/.next"
  cp -a "${RELEASE_DIR}/.next" "${APP_ROOT}/.next"
else
  log "Release directory unavailable — building in place (previous .next preserved until success)"
  npm run build
  if [[ ! -f "${APP_ROOT}/.next/BUILD_ID" ]]; then
    fail "Build succeeded but .next/BUILD_ID is missing"
  fi
fi

if [[ "${SKIP_PM2:-}" == "1" ]]; then
  log "SKIP_PM2=1 — build complete, PM2 not restarted"
  trap - ERR
  exit 0
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "pm2 not found — build complete, skipping process restart"
  trap - ERR
  exit 0
fi

log "Restarting PM2 app: ${PM2_APP}"
pm2 restart "${PM2_APP}" --update-env
pm2 save
pm2 status "${PM2_APP}"

log "Local health check"
curl -fsSI "http://127.0.0.1:${PORT:-5173}" | head -n 1 || log "Warning: localhost health check did not return headers"

if command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t; then
    sudo systemctl reload nginx || log "Warning: nginx reload failed"
  else
    log "Warning: nginx -t failed — not reloading"
  fi
fi

trap - ERR
log "Deploy completed successfully"
log "Rollback: ln -sfn ${PREVIOUS_CURRENT:-<previous-release>} ${CURRENT_LINK} && cp -a ${PREVIOUS_CURRENT:-<previous-release>}/.next ${APP_ROOT}/.next && pm2 restart ${PM2_APP} --update-env"
