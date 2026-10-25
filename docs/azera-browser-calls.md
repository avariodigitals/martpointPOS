# Azera website support calls

The website phone button connects a visitor to a **human support agent** in
`/admin/azera`. It is not the AI voice or Africa’s Talking telephone/IVR path.

## Omnichannel outbound calls

The contact panel's **Call in browser** action uses the existing LiveKit
integration plus a SIP telephone trunk. The agent speaks through the browser;
the customer answers their regular phone. It never opens FaceTime or a `tel:`
link. Phone-network charges are governed by the configured provider.

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

No new database migration is needed. Existing calls/events/presence tables are
used. This repair does not alter production records during local testing.

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
