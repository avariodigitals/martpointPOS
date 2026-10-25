# Azera contact-centre handoff — 25 October 2026

The operational repairs below are implemented locally. This is **not** a claim
that the whole contact centre has been production-verified. No real telephone
calls, provider messages, emails or production database writes were performed.
Unrelated Creator changes in the working tree were preserved.

## Update: no paid LiveKit service

See [the no-paid-LiveKit deployment notes](azera-no-paid-livekit.md).
Migration **135** adds opt-in native telephone recording, direct website AI
voice and restricted self-hosted media controls. Recording and AI voice remain
off by default. The supplied server is shared cPanel hosting; SSH closed before
login. Server capacity and Docker support were not verified and no server
settings were changed. Advanced media deployment requires a suitable existing
host; no paid host or subscription was provisioned.

## Capability status

| Capability | Code status | Required sign-off / remaining limitation |
| --- | --- | --- |
| Browser-to-phone outbound | AT SDK remains default; approved self-hosted SIP is optional only after explicit host/trunk verification | Verify real provider activation/audio. The new path blocks standard LiveKit Cloud endpoints and does not switch to another telephone provider silently |
| Mute, hold/resume and keypad | Connected to AT SDK operations; browser audio/autoplay recovery and cleanup implemented | Verify on the real provider account and target browsers; hold state reflects the SDK request, not an independently confirmed provider receipt |
| Website-to-agent audio | Existing WebRTC path retained; queue-aware availability and atomic call claim now enforce fresh presence and no concurrent agent call | Configure TURN and test separate networks on iOS, Android and desktop |
| Incoming telephone IVR, routing, hours, backups, voicemail | Existing Africa’s Talking flow retained; callback authentication now fails closed without a secret | Provider number/callback activation and each department, busy, unanswered and closed-hours branch need real-call verification; incoming telephone forwarding remains the configured destinations, not a newly registered browser-agent PBX |
| Chat assignment and transfer | Atomic least-loaded matching-queue assignment; searchable online agents, queue moves and release; stale/disabled/wrong-role agents excluded | Apply migration 134; transfer here means **chat** transfer with history, not a telephone transfer |
| WhatsApp replies | Unified inbox dispatches via Cloud API or existing 360dialog; exact business-number mapping and 24-hour reply-window checks | Configure the account ID/token or 360dialog key/number and provider webhook headers; verify provider approval and real delivery |
| Messenger / Instagram replies | Unified inbox dispatches through the configured account and token; inbound signatures checked; echo/redelivery suppression | Configure Meta app/account approval, account IDs/tokens, verify tokens and app secret. Instagram configuration uses Facebook Login messaging, not an interchangeable Instagram Login token |
| Delivery visibility | Pending, provider-accepted, sent, delivered, read, failed and unknown states; provider receipts persisted and replayed if they arrive before the send response | Only actual provider callbacks can prove delivery/read. Instagram receipt support depends on the provider event; no read receipt is invented |
| Retry and duplicate protection | Unique per-conversation client/provider IDs; atomic failed retry; uncertain results require manual confirmation | Unknown sends are never automatically resent. Check the provider inbox before retrying |
| Customer attachments | Website attachment flow retained; WhatsApp media IDs are captured with authenticated, bounded downloads; social attachment notices are retained | Oversized/unsupported provider media must be opened in the provider inbox. This is not a complete outbound media/template composer |
| Private recordings | Public bucket access removed; signed five-minute playback URLs, call/business checks and consent-confirmed manual uploads | Apply migration before enabling. Manual uploads are limited to 4 MB for the server route. Uploading does not enable automatic two-party recording |
| Recording retention | New manual recordings have a 90-day playback-retention timestamp; expired links withheld; voicemail uses existing retention job | Permanent deletion of call recordings is not newly scheduled. Review and approve the retention policy rather than silently deleting old recordings |
| Follow-up work | Due date, notes, status and direct-link panel; deduplicated scheduled staff bell/email reminders | Enable authenticated cron and email routing. Notification failures remain visible in normal notification/email logs |
| Reporting | Server-side WAT From/To, type/direction/status/search, pagination, page CSV, private recording panel; whole-range aggregates and 30-second answer metric | Apply summary RPC. A call is answered only with an answer timestamp; “ended” alone is not a completed/answered conversation. Missing provider costs are not displayed as zero |
| Readiness | Inbox exposes credential-free configuration checks, explicit setup gaps and limitations | “Configured” is not “live verified” |
| Direct staff handover and supervisor listen/whisper/join | Code prepared for an approved self-hosted room server; receiver joins/publishes/accepts before ownership changes | Not live: shared cPanel media hosting and compatible AT trunk not verified/provisioned. Private consultation / warm transfer is still not implemented. These controls cannot operate on direct AT SDK calls |
| Automatic two-party call capture | Native AT incoming `Dial` recording offered only after explicit press-1 consent; distinct private recording import | Requires migration 135 and actual callback/recording-host verification. Does not automatically record AT SDK outbound or every media call; voicemail is separate |
| Continuous website AI voice | Direct OpenAI Realtime browser audio, server-owned session configuration, public published knowledge, interruption support and human-request tool | Opt-in, existing OpenAI audio charges apply. No LiveKit server needed. Browser limit 10 minutes, scheduled provider backstop about 10–15 minutes under normal cron operation; durable call-start/concurrency limits. No voice transcript persistence in this path |
| AI answering the telephone number | **Not implemented** | Requires a verified telephone-to-AI media route. Website speech-to-speech is not evidence of telephone AI support |

## Deployment checklist

1. Review and apply `supabase/migrations/134_azera_contact_centre_operations.sql`,
   then `135_azera_voice_media.sql`
   **before deploying the changed application**. It adds delivery state,
   deduplication, receipt storage, restricted routing/report RPCs, call-busy
   protection, follow-up deduplication and recording privacy.
2. In **Admin → Azera Settings**, use the existing Africa’s Talking API key,
   live username and virtual number. Browser calling no longer depends on
   paid LiveKit. Self-hosted media is optional and gated by approved host/trunk
   configuration; otherwise the call button uses the AT SDK. The old `sip-outbound`
   endpoint now refuses calls and directs staff to the browser workflow.
3. Set `AFRICASTALKING_CALLBACK_SECRET` and put the matching `?secret=…` on
   the provider callback/event/recording URLs. Callbacks no longer accept an
   absent secret. For imported voicemail audio, allow the provider's actual
   HTTPS host with `AFRICASTALKING_RECORDING_HOSTS` if it is outside
   `africastalking.com`; redirects/arbitrary hosts are not silently followed.
4. Set `CRON_SECRET`. Vercel runs `/api/cron/azera-contact-centre` every five
   minutes: reconcile unconfirmed sends/abandoned preparations/disconnected
   browser history, and alert due follow-ups. The existing voicemail retention
   cron also now rejects a missing secret. No cron was executed against live data.
5. For 360dialog, configure `x-webhook-secret` (or Bearer authentication) in
   the channel webhook headers to match Integrations → Webhook Secret. Cloud
   `entry.changes.value` and legacy root payloads are both supported. Configure
   the exact same sending business number in Integrations and Azera Settings.
6. For Meta channels, configure matching account IDs/tokens, a verification
   token and `META_APP_SECRET` (or the channel-specific app-secret variable).
   `META_GRAPH_VERSION` defaults to `v23.0`; match the approved app version.
   Subscribe to actual messaging/delivery/read events supported by the account.
7. Test one authorised inbound and outbound telephone call, website human
   handoff, two-way audio, mute/hold/keypad, decline/timeout/hangup, browser exit,
   chat transfer and each social channel's accepted/delivered/failed path.
   Verify a real follow-up bell/email and a consented private recording.
8. Website AI voice needs direct OpenAI Realtime access, migration 135,
   `AZERA_REALTIME_ENABLED=true`, `CRON_SECRET`, verified five-minute cron
   execution and the business opt-in. Confirm audio charges and live handoff
   before enabling. Recording is separately opt-in with press-1 consent;
   no response/press-2 continues without recording.

## Verification evidence and release cautions

- Previous contact-centre regression run: **713 tests across 66 test files**
  and production build passed. Final extension validation is recorded in
  `azera-no-paid-livekit.md` after tests, lint, TypeScript and build are rerun.
- Mocked regression suite, lint, TypeScript and production build checks cover
  implementation behaviour; they do not certify provider activation or audio.
- Migration was run twice on an **isolated temporary PostgreSQL** database.
  Assertions verified least-loaded queue selection, role/queue exclusion,
  service-only RPC permissions, private storage, correct answered/ended totals,
  answer-time metrics, no concurrent agent phone calls, and atomic website call
  ownership. That temporary database was stopped afterwards; live DB unchanged.
- Synthetic browser QA exercised failed-message retry, report pagination,
  recording/follow-up controls, searchable routing and mobile containment.
  The preview route was removed.
- Production dependency audit reported **13 advisories (2 critical)** in the
  existing dependency graph. No blind `npm audit fix --force`/framework upgrade
  was performed as part of the provider repair. Resolve applicable advisories
  in a separately verified dependency update before production sign-off.

## Provider references

- [Africa’s Talking browser SDK and capability-token contract](https://www.npmjs.com/package/africastalking-client)
- [Official AT capability-token implementation](https://github.com/AfricasTalkingLtd/africastalking-node.js/blob/master/lib/voice.js)
- [360dialog webhook configuration and authentication headers](https://docs.360dialog.com/docs/messaging/webhook)
- [360dialog receipt and inbound message reference](https://docs.360dialog.com/docs/messaging/webhook/webhook-reference)

## Cloudflare-managed browser audio update — 25 October 2026

The no-VPS Cloudflare SFU/TURN website-to-agent path is implemented locally and
requires migration **136** plus server-only credentials and verified cleanup
scheduling. See [setup, cost estimates and exact remaining limitations](azera-cloudflare-setup.md).
No provider account settings or live routes were changed. The self-hosted
supervisor controls are not automatically available on this new transport.
