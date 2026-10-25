# Azera without a paid LiveKit subscription

## Current hosting boundary — 25 October 2026

The website is hosted on **Vercel**, independently of the supplied shared cPanel
account. A Cloudflare-managed website-to-agent audio path is now implemented
locally; see [setup, costs and limitations](azera-cloudflare-setup.md). It does
not require a VPS and does not enable the self-hosted supervisor controls.

The supplied host is shared cPanel hosting. SSH on port 22 closed before login.
No server files, packages, firewall, DNS or live routing were changed. Docker,
resources and persistent-process support have **not** been verified there.
Do not install or start the optional media server until the hosting provider
confirms the account can run it and expose the required TCP/UDP ports.

## Works without a separate media server

- Existing Africa’s Talking browser-to-phone calling remains the default.
- Incoming AT `<Dial>` recording is opt-in. Callers press 1 to agree, or press
  2 / give no response to continue without recording. No press of 1 means no
  recording. Approved provider callbacks import audio into private storage;
  recorded calls are distinct from voicemails. Imports are capped at 25 MB.
- Continuous **website** AI voice uses the OpenAI Realtime WebRTC interface
  directly. Next.js creates the session with a server-only OpenAI key. No
  LiveKit server, subscription or inference service is used for that path.
- AI voice is **not free AI**: existing OpenAI audio charges apply. It is off
  until both deployment and business switches are enabled. No live API call
  was made during this implementation.

Before deploying the application, apply migration **135 after 134**. In
Azera Settings enable recording only after checking the consent script and
the actual provider recording callback/host. A direct AT SDK outbound call is
not automatically recorded by this change.

For website AI voice, first verify OpenAI Realtime model access, microphone,
audio, interruption and human handoff using a consenting tester. Then set
`AZERA_REALTIME_ENABLED=true`, configure `CRON_SECRET`, and enable website AI
voice for the business in Azera Settings. Optional model/voice overrides are
`AZERA_REALTIME_MODEL` (default `gpt-realtime`) and `AZERA_REALTIME_VOICE`
(default `marin`). No provider key is returned to the browser.

The browser ends AI calls after 10 minutes. The authenticated contact-centre
cron must actually run every five minutes to forcibly hang up overdue provider
sessions independently of the browser. Under normal scheduling the server
backstop is about 10–15 minutes; scheduler/provider outages can delay it. Never
enable this option without verifying the cron in the deployment platform.
Database limits are 3 concurrent AI calls globally, 100 starts/business/day
and 6 starts/conversation/day (UTC windows). These are safety limits, not a
money-spend cap or a promise of zero cost.

The AI answers from published `all`/`prospect` knowledge only, cannot access
private customer records or perform account/payment changes, and tells callers
it is AI. The human-request tool ends the AI session and rings the existing
website-to-human call flow. It does not claim a human answered and does not
provide a private consultation / warm telephone transfer. Voice transcripts
are not persisted by this direct browser implementation.

## Optional free/open-source media software

The new `/admin/azera/calls` workspace prepares direct agent handover,
listen-only supervisor access, private coaching in a **separate room**, and
explicit supervisor participation. These controls work only for calls actually
routed through an approved self-hosted room server. They cannot control a
call made directly through the AT browser SDK.

The optional Compose files in `ops/azera-media/` provision nothing by themselves.
They provide a room-server starting point, **not** a complete production SIP,
TURN, recording/egress or TLS deployment. A server administrator must:

1. Verify existing server capacity and hosting permission; no new paid host is
   authorised. Select and pin an approved `LIVEKIT_SERVER_IMAGE` release/digest.
2. Set a generated `LIVEKIT_KEYS` mapping and `MEDIA_PUBLIC_IP`. Keep secret
   values out of git, chat and command output. Do not use development keys.
3. Provide a dedicated HTTPS/WSS hostname/TLS reverse proxy to local port 7880,
   and allow required RTC TCP/UDP ports. Do not overwrite the site's existing
   web-server configuration. Add and test TURN separately for restricted networks.
4. Configure a compatible Africa’s Talking SIP trunk and self-hosted SIP
   service. A SIP **account that requires REGISTER** is not interchangeable
   with LiveKit's supported trunk authentication. Verify this with AT before
   changing any number's live routing. Existing Integrations defaults must not
   accidentally use a different telephone provider.
5. Put the self-hosted credentials/URLs in Admin → Integrations and set:
   `AZERA_MEDIA_MODE=self_hosted`, `AZERA_MEDIA_HOSTS=<exact owned hosts>`.
   Standard `*.livekit.cloud`/`*.livekit.io` endpoints are rejected even if
   allowlisted. Do not point an approved hostname at a paid Cloud alias.
6. Only after trunk verification set `AZERA_AT_SIP_TRUNK_VERIFIED=true`.
   AT hostname aliases outside `africastalking.com` require explicit
   `AZERA_AT_SIP_HOSTS` approval. Without these checks the inbox keeps using
   the original AT browser dialler; there is no paid-Cloud fallback.
7. Test connected audio, invitation/accept/decline/expiry, busy/wrong-queue
   rejection, original-agent cleanup, supervisor permissions and private
   coaching on separate devices. All live controls create audit events.

The available handover is **direct**: the receiver joins and accepts before
the old agent is removed. Private agent-to-agent consultation/warm transfer,
automatic recording of every media/SDK call, and an AI agent answering the
telephone number are still outside this implementation. They are not marked
complete merely because a UI or a Compose file exists.

## Local validation

- **767 tests in 74 files passed**; touched-file ESLint, TypeScript,
  `git diff --check` and the final Next.js production build all passed.
- Migration 135 was applied twice to an isolated temporary PostgreSQL database.
  Assertions verified opt-in, duplicate/concurrent AI-call limits, service-only
  RPC access, transfer ownership and exclusion during an active call control.
  No live database was touched; the temporary server was stopped afterwards.
- Synthetic browser checks covered desktop and 390px mobile layout, wrapped
  long text, search, transfer selection/feedback and 44px action targets with
  no horizontal overflow. Every preview API request was mocked. The preview
  route/tab and viewport override were removed afterwards.
- Compose/YAML syntax was checked, but Docker is unavailable locally and the
  supplied shared host did not provide an SSH session. The media containers,
  SIP compatibility, recordings, live AI audio and provider billing are **not**
  certified by these checks.
- Existing production dependency advisories still need the separately
  validated dependency update described in the main readiness report.

## References

- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime)
- [Africa’s Talking Dial recording example](https://help.africastalking.com/en/articles/1205739-how-do-i-change-my-caller-id)
- [LiveKit self-hosting](https://docs.livekit.io/transport/self-hosting/)
- [LiveKit SIP feature compatibility](https://docs.livekit.io/telephony/)
