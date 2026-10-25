# Cloudflare-managed Azera website calls

## What is integrated

Next.js remains on Vercel. The visitor and assigned staff member each publish
one microphone track and receive the other participant through Cloudflare
Realtime SFU. The backend holds all permanent provider secrets and authorizes
publication/subscription against the call and conversation. A separate TURN
key supplies short-lived, participant-scoped ICE credentials for restricted
networks. No VPS, Cloudflare Worker, Durable Object or paid RealtimeKit is
required by this implementation.

The SFU application is **not attached to a website domain**. Its App ID selects
the provider application; Azera's existing HTTPS endpoints authorize browsers.
Keep the existing MartPoint/Vercel domain and DNS. Do not point a DNS record at
the App ID, paste secrets into a web page or add secrets to frontend JavaScript.

Africa's Talking telephone calls retain their existing provider path. This
integration is two-party website-to-human audio, not an SFU-to-telephone SIP
bridge. The self-hosted supervisor workspace does not control these calls.
Supervisor listening, coaching, handover, automatic browser-call recording,
telephone AI and multiple native AI voice providers are **not implemented by
this Cloudflare change**. Existing direct website AI voice remains separate.

## Setup using your existing Cloudflare account

1. Cloudflare dashboard → your account → Realtime → Serverless SFU. Use the
   application you created. Copy its **App ID** and **App Secret** privately.
   The App Secret is not your global Cloudflare API key.
2. Realtime → TURN Service → create a TURN key. Keep its **Key ID** and the
   associated **API token**. The TURN credentials are separate from the SFU
   App Secret. Do not send any of these secrets through chat.
3. In Vercel → the Next.js project → Settings → Environment Variables, add:

   | Variable | Value |
   | --- | --- |
   | `CLOUDFLARE_REALTIME_APP_ID` | SFU App ID |
   | `CLOUDFLARE_REALTIME_APP_SECRET` | SFU App Secret |
   | `CLOUDFLARE_TURN_KEY_ID` | TURN Key ID |
   | `CLOUDFLARE_TURN_API_TOKEN` | TURN API token |
   | `CRON_SECRET` | Existing strong cron secret |
   | `AZERA_BROWSER_MEDIA` | `cloudflare` only when ready to enable |

   Never prefix these variables with `NEXT_PUBLIC_`. Choose the intended
   Vercel environment; use a separate SFU app/keys for Preview testing when
   possible. Updating environment variables requires a redeploy.
4. Apply migration **136 after 134 and 135** to the application's database.
   This creates service-only participant/session state and an admission RPC.
   Do not run test fixtures against production.
5. Verify `/api/cron/azera-contact-centre` runs every five minutes with the
   existing Bearer `CRON_SECRET`. Vercel's Hobby cron runs only once daily;
   frequent Vercel cron requires Pro/Enterprise. If on Hobby, use an approved
   external scheduler that securely supplies the header instead; do not make
   this endpoint public or silently remove cleanup. No scheduler is provisioned
   by this code. Existing frequent cron entries also need a compatible plan.
6. Redeploy, then Admin → Azera Settings → **Cloudflare website calls**. The
   status card checks credential presence and database schema without exposing
   secret values or placing a call. "Configured" is not proof of live audio.
7. Test a visitor and an online staff user in the correct queue on separate
   browsers/devices. Check two-way audio, microphone denial, autoplay recovery,
   mute, decline, hang up from both sides, lost network, closed tab, iOS Safari,
   Android Chrome and Wi-Fi-to-mobile-data combinations. Verify the provider
   dashboard stops forwarding after termination and the cron cleans abandoned
   calls. Only then select `AZERA_BROWSER_MEDIA=cloudflare` for Production.

## Safety and operating limits

- Off unless explicitly selected, both SFU/TURN credentials exist, and a cron
  secret is configured. Explicit Cloudflare selection with missing setup fails
  safely; it does not secretly enable a paid provider or switch to STUN-only.
- Atomic DB admission: at most **10** concurrent Cloudflare website calls,
  one live call per conversation, and **12 starts/conversation/day** (UTC).
- One audio publication/subscription per participant. No arbitrary remote
  session IDs, videos, data channels or cross-call track discovery are accepted.
- Agent audio requires the existing atomic queue/online/busy claim. Other
  administrators do not gain access to live media merely by knowing a call ID.
- Temporary TURN credentials last **40 minutes**, are reused for that
  participant/call, and are not permanent account credentials. Do not expose
  them in analytics or logs. Provider-issued credentials cannot themselves be
  limited to just one WebRTC call, so their short expiry limits leakage risk.
- Browser maximum is **30 minutes** from call creation. Calls heartbeat every
  15 seconds once connected. The five-minute cron detects stale participants,
  unanswered calls and over-limit calls, then force-closes provider tracks.
- End call stops the local microphone immediately, but history is not marked
  ended until the provider confirms closure. Failed cleanup remains retryable.
  The cron reclaims abandoned operation locks after two minutes and processes
  up to two expired calls per run to stay within function execution limits.
- These are safety limits, **not a financial spending cap**. Provider or
  scheduler outages can delay cleanup. Retain the provider credentials until
  all outstanding calls have been closed, even when disabling new calls.

## Likely costs — checked 25 October 2026

Cloudflare SFU and TURN share **1,000 GB/month free**, then **US$0.05/GB** of
billable egress. This is one shared allowance, not 1,000 GB for each product.
Ingress is free. SFU-to-TURN traffic is not double-counted as documented by
Cloudflare. Other apps on the same billing allowance may consume it too.

For planning only, assume **2 MB total billable egress per minute of a
two-person audio call**, including both listeners. This is an estimate, not
measured usage or a provider guarantee: codec bitrate, silence, packet overhead,
retransmissions and routing can change it. Decimal GB used below.

| Monthly activity | Estimated egress | Cloudflare SFU/TURN charge if allowance is unused elsewhere |
| --- | ---: | ---: |
| 1,000 calls × 10 minutes | 20 GB | $0 |
| 10,000 calls × 10 minutes | 200 GB | $0 |
| 1,500 GB actual combined billable egress | 1,500 GB | $25 |

Formula: `max(0, combined_billable_GB - 1000) × $0.05`.

Other costs are separate:

- **Vercel:** existing plan plus any function/transfer overages. This integration
  keeps raw audio off Vercel; it uses API calls for negotiation and heartbeats.
  Frequent Vercel cron may require a plan you do not currently have.
- **Database:** existing Supabase usage/overages; heartbeats/session state use
  queries and writes. No automatic recording storage is added by this path.
- **Africa's Talking:** existing number rental, call legs, recording and account
  tariffs where applicable. A web-to-web SFU call is not a mobile-network call.
  Check the live account contract; no unverified per-minute rate is assumed.
- **AI:** existing AI usage charges apply only to the separate AI path; Cloudflare
  bandwidth does not pay for an AI model. No Workers AI subscription is enabled.
- **No new VPS, LiveKit Cloud, RealtimeKit, Workers or Durable Object service**
  is provisioned. This does not promise a zero total monthly infrastructure bill.

## Local verification

794 tests across 78 files passed, along with touched-file ESLint, TypeScript
and the Next.js production build. Migration 136 was applied twice to an
isolated temporary PostgreSQL database; reservation, duplicate-call and
service-only access assertions passed. The temporary database was stopped.
Desktop and 390px mobile preview checks confirmed wrapped text, no horizontal
overflow and a 44px refresh button. The preview route was removed. No live
provider requests, audio calls, production migrations or deployments were made.

## References

- [Cloudflare SFU setup](https://developers.cloudflare.com/realtime/sfu/get-started/)
- [Connection patterns](https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/)
- [SFU/TURN pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)
- [TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel function costs](https://vercel.com/docs/functions/usage-and-pricing)
- [Africa's Talking Nigeria voice pricing](https://help.africastalking.com/en/articles/15433615-voice-pricing-nigeria)
