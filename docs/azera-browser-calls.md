# Azera website support calls

The website phone button connects a visitor to a **human support agent** in
`/admin/azera`. It is not the AI voice or Africa’s Talking telephone/IVR path.

The separate **Talk to Azera · AI voice** action uses direct OpenAI Realtime
after migration 135 and explicit opt-in. It does not require LiveKit. Existing
OpenAI audio charges apply; see [the no-paid-LiveKit notes](azera-no-paid-livekit.md).

## Omnichannel outbound calls

**Current path (25 October 2026):** the contact panel's **Call in browser** action
uses the official Africa’s Talking browser SDK and the existing AT configuration.
It speaks through the browser, not FaceTime or a `tel:` link. One-hour capability
tokens are issued server-side; the provider API key is never sent to the browser.
Microphone permission precedes preparation, and the SDK dials only once it is
ready. Mute, hold/resume, keypad and inline-audio recovery use the provider SDK.
An active call renews the staff session; this stops on hangup. Provider activation,
balance and real-device audio must still be tested. Apply migrations **134 and 135** before
deploying. See [the deployment checklist and limitations](./azera-contact-centre-readiness.md).

### Optional self-hosted media path

The lower-level LiveKit/SIP path is selected only when an explicitly approved
self-hosted host and an Africa’s Talking-compatible trunk have been configured
and verified. Standard LiveKit Cloud URLs are blocked. Without that opt-in the
button keeps using the direct AT SDK; no paid service is selected as fallback.
The shared cPanel host has not been verified as able to run these services.

Configure **Admin → Integrations → LiveKit Calls**: server URL, public WebSocket
URL, API key/secret, SIP hostname, SIP username/password, caller number and
destination country. Missing credentials produce a clear setup state, not a
fake connected call. Configuring Africa’s Talking IVR alone does not fill these
LiveKit/SIP fields. No provider account or paid service is provisioned by this
change. See [LiveKit outbound calling](https://docs.livekit.io/telephony/making-calls/outbound-calls/).

Call preparation creates a private room and history record but does not dial.
The agent joins and publishes their microphone first; the server verifies that
audio participant before atomically claiming the telephone leg. A retry cannot
dial the same call twice. Status follows the SIP participant's answer/hangup,
and End call deletes the room to stop both legs. The call is scoped to its
owning agent and stored conversation number. Ringing is limited to 60 seconds
and a telephone leg to one hour. Page exit makes a best-effort hangup; an abrupt
network/device loss still requires normal provider monitoring. No real phone
calls are placed by the mocked regression tests.

The desktop details panel separates contact information, AI/ticket/activity
status, and actions into readable cards. Background message polling no longer
replaces the thread with a spinner. It merges rows in place, preserves pending
sends and per-conversation drafts, ignores late responses for another thread,
retains messages on network errors, and follows new messages only when the
agent is near the bottom. The messages API loads the latest 100 rows rather
than repeatedly returning the first 100 rows of a long conversation.

## Release requirements

- Deploy/restart Next.js so `Permissions-Policy` changes to
  `camera=(), microphone=(self), geolocation=()`. The old `microphone=()` policy
  prevented calls before any signaling could take place. User permission is
  still required; this does not enable a microphone automatically.
- Staff must open `/admin/azera` and go online. Presence must have a heartbeat
  within the preceding 90 seconds. Enable sound for an audible incoming alert.
- Configure a TURN relay for restrictive office/mobile networks. STUN alone
  cannot guarantee a connection between arbitrary networks. Set server-only
  `AZERA_TURN_URLS` (comma-separated `turn:`/`turns:` URLs) and either:
  - `AZERA_TURN_SECRET`: a coturn-compatible shared secret; the authorized call
    endpoint creates one-hour credentials without exposing that secret; or
  - `AZERA_TURN_USERNAME` and `AZERA_TURN_CREDENTIAL`: provider-issued credentials.
  Do not prefix these settings with `NEXT_PUBLIC_`. Short-lived relay
  credentials are delivered only to authorized call participants. The existing
  AI/SIP credentials are not interchangeable with TURN credentials.

Migration 134 is required for the updated contact-centre routing and private
recording controls. Local tests do not modify production records.

## Behaviour

- Microphone permission is obtained before creating a website call record.
- If no staff member is available, the visitor gets a clear invitation to
  continue in chat, without a false ringing screen.
- An agent sees Answer/Decline immediately; accepting atomically claims the
  call. Another agent cannot answer or terminate that claimed call.
- SDP and ICE are exchanged only with the other participant; remote ICE waits
  for the remote description and is applied once. HTTP errors are not ignored.
- Both ends play remote audio. A “Tap to hear the call” action handles browser
  autoplay restrictions. Active means the peer connection actually connected.
- Answered calls use the schema's `active` status (not `answered`). Hangup,
  decline, timeout and failure persist terminal statuses. Disconnects get a
  ten-second recovery window. Ringing expires after a minute on the client.
- Page exit/unmount stops the microphone and makes a best-effort keepalive
  hangup. Like any browser application, abrupt device/network loss can prevent
  delivery; staff are never offered ringing records older than 90 seconds.
- Public tokens are bound to the requested call's conversation/business/visitor.
  Customer cookies are scoped to their own business. Visitors can terminate
  their own browser call but cannot answer it or change telecom/billing fields.

## Verification

Automated tests use mocked browser media and mocked database operations; they
place no real calls. Run:

```sh
npx vitest run __tests__/azera-webrtc.test.ts __tests__/azera-call-routes.test.ts __tests__/azera-call-access.test.ts __tests__/azera-public-auth.test.ts
npx tsc --noEmit
npm run build
```

Before production sign-off, use two consenting testers on separate devices:
Safari/iOS and Chrome/Android, plus desktop staff. Check microphone denial,
Answer, two-way sound, mute, autoplay recovery, decline, remote hangup, unanswered
timeout, page exit and Wi-Fi-to-mobile network changes. Test TURN with a
restrictive network. A mocked test suite cannot certify real device audio or
production firewall/relay behaviour.

## Africa's Talking incoming browser phone

Migration 137 adds authenticated receiving phones in the admin header. See
`docs/AFRICASTALKING_INTEGRATION.md` for production callback/event URLs,
department mapping and the required live acceptance checks. Migrations 141 and
142 add the production safety layer: an administrator must assign each user to
one or more voice queues under **Admin → Azera → Voice Agent Assignments**.
The user's normal portal role only allows access to the phone feature; it does
not grant access to every queue. The server ignores a browser's requested queue
list and registers only the saved assignment.

The incoming card shows the selected queue and provides mute, hold, keypad,
blind transfer and a conference request. Transfer uses the Africa's Talking
Events URL to return a provider `Dial` action to the selected online agent.
Conference is recorded and guarded, but remains disabled until the tenant's
Africa's Talking conference capability and room/participant behaviour are
verified on a real test number; the app does not silently claim a conference
was joined. If no eligible agent is online, the existing configured fallback
or voicemail route is used.

Voicemail is handled in **Admin → Azera → Voicemails**. The recording callback
downloads the provider recording into the private `azera-voicemails` Supabase
bucket, returns a short-lived signed playback link, and supports status, notes,
follow-up date and assignment. The retention setting controls deletion. Africa's
Talking's dashboard copy is short-lived, so the download step is important.
Do not confuse this telephone route with website-to-agent Cloudflare audio.
# Header dial pad and creator calling

Authorised Azera staff can open the **phone icon in the admin header → Make a
call**, type a full phone number, check the displayed number and press **Call
number**. Nigerian 11-digit `080…` numbers are normalised to `+234…`; other
destinations should include their country code. This uses Africa’s Talking
browser audio, not the operating system's telephone/FaceTime handler.

Creator profiles and creator applications have **Call creator**. This opens the
same persistent header phone with the creator selected; it does not immediately
call them. Press Call after checking the contact. The server reloads the saved
phone number and requires both Azera and creator-view permissions. Missing or
removed creator records cannot be called by that action. There is no requirement
to create a chat conversation first, and the call does not manufacture one.

Manual and creator calls use the configured MartPoint virtual number/business
mapping, never a browser-supplied tenant or caller ID. Source record IDs are
stored in call events, and call history retains the agent, number and outcome.
The existing provider callback binds a prepared call to its stored destination.
Cloudflare and LiveKit are not required for this dial-pad path. Voice/WebRTC
activation, account balance and provider destination restrictions still apply.

Only one live call per staff member is permitted. The incoming browser phone
pauses for outbound calls and resumes after end-state persistence. Cross-origin
preparations are rejected. Preparation is rate-limited to 20 attempts per
hour/user/IP through the existing rate limiter (distributed when Redis is
configured); this is not a guaranteed financial spending cap. Existing database
call-concurrency migrations remain required; no new migration is introduced.

Before calling clients, make one authorised test call: confirm the destination
rings, caller ID, two-way microphone/audio, mute, hold, keypad and hang-up from
both ends, then inspect call reports and provider events. Automated SDK mocks
and successful builds do not constitute live carrier/audio verification.

Authentication was checked on 26 October 2026 after correcting the saved
application username: the AT capability endpoint returned HTTP 201 and issued a
token. This verifies API authentication only, not ringing or two-way audio.

Browser-call preparation now reads the current saved credentials directly from
the database instead of the one-hour website settings cache. Saving credentials
on production cannot invalidate a separate local/preview cache; using cached
credentials was reproducing authentication failures after a correct save.

One authorised live outbound test on 26 October 2026 subsequently rang the
recipient's phone, and the recipient confirmed answering. Call history recorded
the provider session, answered time, terminal `ended` state and 24-second talk
duration. The test was ended and not repeated. This establishes ringing,
answering and hang-up/history, not two-way human audio, caller-ID display,
hold/mute/DTMF quality or every destination. This staff browser dialler does not
automatically start the separate AI voice agent or speak on the staff's behalf.
