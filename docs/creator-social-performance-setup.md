# Creator social performance sync

## What is implemented

The first provider is TikTok. A signed-in creator can connect their own account from **Creator Portal → Profile**. Challenge video URLs are matched to videos returned for that authorized account; MartPoint appends verified API metric snapshots and leaves prior snapshots intact. The scheduled sync runs every six hours. MartPoint referral clicks/leads remain separate from social engagement.

This requires the database migration, TikTok developer-app configuration and production environment variables below. Until those are set, the creator profile shows that TikTok linking is not configured. Instagram and YouTube are not enabled by this first provider slice.

## TikTok developer app

1. Create/configure the MartPoint app in TikTok for Developers and enable the Login Kit and Display API products required for OAuth and video queries.
2. Request the scopes `user.info.basic`, `user.info.profile`, and `video.list`. TikTok must approve the app/scopes before creators can grant them.
3. Add this exact redirect URL to the app’s allowed redirect URLs:

   `https://www.martpoint.com.ng/api/creator/social-accounts/tiktok/callback`

   If production uses a different canonical host, use that host consistently in `NEXT_PUBLIC_SITE_URL` and the TikTok app.
4. Add these server-side environment variables to Vercel (Production and Preview only if those environments should authorize accounts):

   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `CREATOR_SOCIAL_TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -base64 32`; keep stable and private, because rotating it invalidates stored connections.
   - `NEXT_PUBLIC_SITE_URL=https://www.martpoint.com.ng`
   - `CRON_SECRET` — required in production for the scheduled sync endpoint.

   Never expose the TikTok client secret or encryption key with a `NEXT_PUBLIC_` prefix.
5. Apply `supabase/migrations/143_creator_social_performance_sync.sql` to the project database, then deploy the Next.js app. Vercel will schedule `/api/cron/creator-social-metrics` every six hours.
6. Test with an active creator account: open **Creator Portal → Profile → Connect TikTok**, approve the scopes, submit a public TikTok video URL to an eligible active challenge, then inspect the creator’s challenge metrics after the next scheduled sync. The first sync can also be invoked by an authorized operator using `GET /api/cron/creator-social-metrics` with `Authorization: Bearer <CRON_SECRET>`.

The API only verifies canonical TikTok video URLs containing a video ID. Short links that do not expose the ID are not synced yet. API access and returned fields depend on TikTok app approval and the creator’s authorization; if authorization expires, the profile reports that reconnection is needed.
