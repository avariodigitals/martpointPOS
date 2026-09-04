#!/usr/bin/env bash
# =============================================================================
# MartPoint — Supabase → Cloudflare R2 backup script
# =============================================================================
# Dumps the Supabase Postgres database (custom format, compressed) and uploads
# the artifact to a Cloudflare R2 bucket via its S3-compatible API. Also prunes
# objects older than BACKUP_RETENTION_DAYS.
#
# Designed to run inside the GitHub Actions workflow
#   .github/workflows/backup-supabase-to-r2.yml
# but can also be run locally for testing:
#   SUPABASE_DB_URL=... R2_BUCKET=... R2_ENDPOINT=... \
#     AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#     AWS_DEFAULT_REGION=auto AWS_PROFILE=r2 \
#     bash scripts/backup-supabase-to-r2.sh
#
# Required environment variables:
#   SUPABASE_DB_URL          postgresql://postgres:PASS@db.<ref>.supabase.co:5432/postgres
#   R2_BUCKET                R2 bucket name (e.g. martpoint-backups)
#   R2_ENDPOINT              https://<account-id>.r2.cloudflarestorage.com
#
# Optional:
#   BACKUP_RETENTION_DAYS    Days to keep (default 30)
#   R2_PROFILE               AWS profile to use (default r2)
# =============================================================================
set -euo pipefail

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Portable "N days ago in UTC, formatted YYYY-MM-DD". Uses GNU date -d when
# available (Linux / GitHub Actions runner), falls back to BSD date (macOS)
# for local testing.
days_ago_utc() {
  local days="$1"
  if date -u -d "${days} days ago" +%Y-%m-%d >/dev/null 2>&1; then
    date -u -d "${days} days ago" +%Y-%m-%d
  else
    # BSD date (macOS): -v-${days}d shifts the day. -u forces UTC.
    date -u -v-${days}d +%Y-%m-%d
  fi
}

# --- Required env -----------------------------------------------------------
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
R2_PROFILE="${R2_PROFILE:-r2}"
WORK_DIR="$(mktemp -d)"
LOG_FILE="/tmp/supabase-backup.log"
BUCKET_PREFIX="supabase"

# Redirect everything to the log AND stdout (so GitHub Actions captures it).
exec > >(tee -a "$LOG_FILE") 2>&1

log "Starting Supabase → R2 backup"
log "Bucket: s3://${R2_BUCKET}/${BUCKET_PREFIX}/  (endpoint: ${R2_ENDPOINT})"
log "Retention: ${RETENTION_DAYS} days"

# --- Sanity checks ----------------------------------------------------------
command -v pg_dump >/dev/null 2>&1 || { log "ERROR: pg_dump not found"; exit 1; }
command -v aws    >/dev/null 2>&1 || { log "ERROR: aws CLI not found"; exit 1; }

# Verify R2 credentials work before spending time on the dump.
log "Verifying R2 connectivity..."
if ! aws --profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" \
         --region auto s3api head-bucket --bucket "$R2_BUCKET" 2>/dev/null; then
  log "ERROR: cannot access bucket '${R2_BUCKET}' at ${R2_ENDPOINT}"
  log "Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID secrets."
  exit 1
fi

# --- Dump -------------------------------------------------------------------
# Custom format (-Fc) gives best compression and works with pg_restore.
DATE_TAG="$(date -u +%Y-%m-%d)"
DUMP_FILE="${WORK_DIR}/supabase-backup-${DATE_TAG}.dump"

log "Running pg_dump → ${DUMP_FILE}"
# --no-owner / --no-privileges keep the dump portable across Supabase projects.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  --file="$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "Dump complete: ${DUMP_SIZE}"

# --- Upload -----------------------------------------------------------------
KEY="${BUCKET_PREFIX}/$(date -u +%Y)/$(date -u +%m)/supabase-backup-${DATE_TAG}.dump"
log "Uploading to s3://${R2_BUCKET}/${KEY}"

aws --profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --region auto \
    s3 cp "$DUMP_FILE" "s3://${R2_BUCKET}/${KEY}" \
    --no-progress

# Tag the object with metadata so lifecycle/auditing is easier.
# R2 does not implement PutObjectTagging, so this is best-effort — a failure
# here is logged but does not abort the backup (the object is already uploaded).
if ! aws --profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --region auto \
    s3api put-object-tagging \
    --bucket "$R2_BUCKET" \
    --key "$KEY" \
    --tagging "$(printf '{"TagSet":[{"Key":"project","Value":"martpoint"},{"Key":"source","Value":"supabase"},{"Key":"created","Value":"%s"}]}' "$DATE_TAG")" \
    >/dev/null 2>&1; then
  log "WARNING: put-object-tagging failed (R2 may not support it) — backup object is still uploaded"
fi

log "Upload complete: s3://${R2_BUCKET}/${KEY}"

# --- Prune old backups ------------------------------------------------------
CUTOFF_DATE="$(days_ago_utc "${RETENTION_DAYS}")"
log "Pruning objects older than ${CUTOFF_DATE} under ${BUCKET_PREFIX}/"

# List objects under the prefix, filter by LastModified in jq (lexicographic
# ISO-8601 comparison is safe here because we format the cutoff as YYYY-MM-DD,
# which sorts before any same-day timestamp), and emit one Key per line.
OLD_KEYS_JSON="$WORK_DIR/old-keys.json"
aws --profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --region auto \
    s3api list-objects-v2 \
    --bucket "$R2_BUCKET" \
    --prefix "${BUCKET_PREFIX}/" \
    --output json > "$OLD_KEYS_JSON"

# jq: extract Keys whose LastModified < cutoff. Handle empty bucket gracefully
# (Contents may be null).
OLD_KEYS=$(jq -r --arg cutoff "$CUTOFF_DATE" \
  '[.Contents[]? | select(.LastModified < $cutoff) | .Key] | .[]' \
  "$OLD_KEYS_JSON")

if [[ -n "$OLD_KEYS" ]]; then
  # Build the delete-objects payload directly with jq (one {Key: "..."} per line).
  DELETE_PAYLOAD=$(printf '%s\n' "$OLD_KEYS" \
    | jq -R -s 'split("\n") | map(select(length>0)) | {Objects: map({Key: .}), Quiet: true}')

  PRUNE_COUNT=$(printf '%s\n' "$OLD_KEYS" | grep -c .)
  log "Found ${PRUNE_COUNT} object(s) to delete"

  aws --profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --region auto \
      s3api delete-objects \
      --bucket "$R2_BUCKET" \
      --delete "$DELETE_PAYLOAD" >/dev/null
  log "Pruned ${PRUNE_COUNT} old object(s)"
else
  log "No objects older than ${CUTOFF_DATE} — nothing to prune"
fi

# --- Cleanup ----------------------------------------------------------------
rm -f "$DUMP_FILE"
rmdir "$WORK_DIR" 2>/dev/null || true

log "Backup finished successfully"
