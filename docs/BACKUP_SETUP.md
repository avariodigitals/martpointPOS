# Supabase → Cloudflare R2 Backup

Automated daily backup of the MartPoint Supabase (Postgres) database to
Cloudflare R2, driven by a GitHub Actions cron workflow.

- **Schedule:** 03:00 UTC every day (manual trigger also available)
- **Retention:** 30 days (older objects are pruned automatically)
- **Format:** `pg_dump --format=custom` (compressed, restorable with `pg_restore`)
- **Cost:** $0 — fits inside R2's 10 GB free tier and GitHub Actions' free
  minutes for a typical POS dataset.

## Why this setup

Supabase's free tier keeps daily backups for only 7 days and does **not** let
you download them. This workflow gives you an independent, off-site, downloadable
copy that survives even if the Supabase project is paused or deleted.

R2 is used instead of S3 because its free tier (10 GB storage, free egress) is
more generous and the S3-compatible API means we can use the standard `aws` CLI.

## Files

| File | Purpose |
| --- | --- |
| `.github/workflows/backup-supabase-to-r2.yml` | Scheduled workflow that runs the backup |
| `scripts/backup-supabase-to-r2.sh` | The dump → upload → prune script |

## One-time setup

### 1. Create the R2 bucket

1. Sign in to the **Cloudflare dashboard** → **R2 Object Storage**.
2. Create a bucket, e.g. `martpoint-backups`. Pick the auto-region.
3. Note your **Account ID** (top right of the Cloudflare dashboard, or in the
   URL: `dash.cloudflare.com/<account-id>`).

### 2. Create R2 API credentials

1. In the Cloudflare dashboard go to **R2** → **Manage R2 API Tokens**
   (or **API Tokens** under R2 in the left nav).
2. Click **Create API token**.
3. Permissions: **Object Read & Write**.
4. Specify the bucket you just created (or "Apply to all buckets" if you prefer).
5. Create it and copy:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (shown on the same dialog)

   These are shown only once — save them somewhere safe immediately.

### 3. Get the Supabase direct database URL

1. Supabase dashboard → your project (`hnkwnnqcbkfqcnxxbsun`) →
   **Project Settings** → **Database**.
2. Under **Connection string**, choose **URI** and the **Direct connection**
   (port `5432`, **not** the pooler on `6566` — `pg_dump` needs a real
   connection, not pgBouncer).
3. The string looks like:
   ```
   postgresql://postgres:[YOUR_DB_PASSWORD]@db.hnkwnnqcbkfqcnxxbsun.supabase.co:5432/postgres
   ```
4. Replace `[YOUR_DB_PASSWORD]` with the database password you set when creating
   the project. If you've lost it, reset it in **Database → Database password**.

> The database password is **different** from `SUPABASE_SERVICE_ROLE_KEY`.
> The service role key is for the REST/Storage API; `pg_dump` needs the
> Postgres password.

### 4. Add GitHub secrets

In your GitHub repo: **Settings → Secrets and variables → Actions →
New repository secret**. Add these four:

| Secret name | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 token access key ID |
| `R2_SECRET_ACCESS_KEY` | R2 token secret access key |
| `R2_BUCKET` | `martpoint-backups` (or whatever you named it) |
| `SUPABASE_DB_URL` | The full `postgresql://...` connection string from step 3 |

### 5. Run it once manually

1. GitHub repo → **Actions** tab → select **"Backup Supabase to Cloudflare R2"**.
2. Click **Run workflow** → **Run workflow** on the `main` branch.
3. Watch the run. The first backup should complete in a few minutes for a small
   DB. If it fails, download the `backup-log` artifact for details.

After the first successful run you'll see objects under
`s3://martpoint-backups/supabase/YYYY/MM/supabase-backup-YYYY-MM-DD.dump`.

## How to restore

Backups are `pg_dump --format=custom` files — restore with `pg_restore`.

### Restore into a fresh Supabase project

1. Create a new Supabase project (or use an existing one you want to overwrite).
2. Get its direct connection string (same steps as setup step 3).
3. Download the dump from R2:
   ```bash
   aws --profile r2 --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
       --region auto s3 cp \
       s3://martpoint-backups/supabase/2026/09/supabase-backup-2026-09-04.dump \
       ./restore.dump
   ```
4. Restore (run from a machine with `pg_restore` installed, e.g. the GitHub
   Actions runner or any machine with `postgresql-client`):
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="postgresql://postgres:[PASSWORD]@db.<new-ref>.supabase.co:5432/postgres" \
     ./restore.dump
   ```
   - `--clean --if-exists` drops existing objects before recreating them.
   - `--no-owner --no-privileges` avoids permission errors when restoring into a
     project with a different role OID.

> Tip: for a quick "what's in this backup" peek without restoring:
> ```bash
> pg_restore --list ./restore.dump | head -50
> ```

## Monitoring

- The workflow appears in the **Actions** tab. Failed runs send email to repo
  collaborators by default.
- The script writes a timestamped log to `/tmp/supabase-backup.log`, which the
  workflow uploads as an artifact (`backup-log`) for 7 days on failure.
- To check what's in the bucket at any time:
  ```bash
  aws --profile r2 --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
      --region auto s3api list-objects-v2 \
      --bucket martpoint-backups --prefix supabase/ \
      --query 'Contents[*].{Key: Key, Size: Size, LastModified: LastModified}' \
      --output table
  ```

## Cost notes

- **R2 free tier:** 10 GB storage + free egress. A compressed `pg_dump -Fc` of a
  small-to-medium POS database is typically a few MB; 30 days of retention will
  be well under 1 GB.
- **GitHub Actions free tier:** 2,000 minutes/month for private repos (unlimited
  for public). Each run takes a few minutes, so daily backups use ~150
  minutes/month — comfortably within the free quota.

## Local testing

You can run the script outside GitHub Actions to debug:

```bash
export SUPABASE_DB_URL="postgresql://postgres:PASS@db.hnkwnnqcbkfqcnxxbsun.supabase.co:5432/postgres"
export R2_BUCKET="martpoint-backups"
export R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export AWS_PROFILE=r2
export AWS_DEFAULT_REGION=auto

# Configure ~/.aws/credentials with an [r2] profile first, then:
bash scripts/backup-supabase-to-r2.sh
```
