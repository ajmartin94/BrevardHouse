#!/bin/sh
# NFR-4: back up the SQLite DB (safe online copy) and uploaded media.
# Schedule nightly via cron/launchd:  0 3 * * *  sh /path/to/scripts/backup.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$ROOT/backups/$STAMP"
mkdir -p "$DEST"
sqlite3 "$ROOT/server/data/brevard.db" ".backup '$DEST/brevard.db'"
tar czf "$DEST/uploads.tar.gz" -C "$ROOT/server/data" uploads
# keep the last 14 backups
ls -dt "$ROOT"/backups/*/ | tail -n +15 | xargs rm -rf 2>/dev/null || true
echo "Backup written to $DEST"
