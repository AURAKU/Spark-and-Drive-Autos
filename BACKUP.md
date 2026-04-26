# Spark & Drive Autos Backup & Restore

This runbook defines safe backup/restore steps before and after Hostinger/VPS deployment.

## Daily Database Backup

Run:

`npm run backup:db`

This script:
- reads `DATABASE_URL` from environment
- creates a timestamped PostgreSQL SQL dump
- stores output in `backups/db/`
- uses filename format `sparkdrive-db-YYYY-MM-DD-HH-mm.sql`

## Restore Database

Run:

`npm run restore:db -- backups/db/sparkdrive-db-YYYY-MM-DD-HH-mm.sql`

Notes:
- restore requires a backup file path argument
- restore requires explicit interactive confirmation (`RESTORE`)
- never run unattended in production

## Backup Storage Location

- Local server path: `backups/db/`
- Keep this folder private (not web-served).

## Copy Backups Off Server

Use a secure remote copy target (object storage or another locked server). Example:

`scp backups/db/sparkdrive-db-YYYY-MM-DD-HH-mm.sql user@backup-host:/srv/sparkdrive-backups/db/`

Or sync to object storage with your approved backup tool.

## Hostinger / VPS Cron Example

Run daily backup at 2:30 AM server time:

`30 2 * * * cd /var/www/spark-drive-autos && /usr/bin/env DATABASE_URL="$DATABASE_URL" /bin/bash scripts/backup-db.sh >> /var/log/sparkdrive-backup.log 2>&1`

Recommended:
- rotate old backups (e.g., keep 30-90 days)
- copy backups to off-server storage immediately after creation
- test restore monthly

## Security Warnings

- Do **not** commit backup files to GitHub.
- Do **not** commit `.env` or secrets to GitHub.
- Do **not** place user documents in any public backup folder.
- Cloudinary assets remain in Cloudinary as external storage source-of-truth.
