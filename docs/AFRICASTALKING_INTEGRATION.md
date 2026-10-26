# Africa's Talking integration

The Next.js callback endpoints are provider-facing and accept Africa's Talking's
form-encoded POST bodies. Every accepted request is stored in
`africastalking_webhook_events` with its raw body, headers and parsed payload.

## Required deployment settings

Set these in the production environment:

```text
AFRICASTALKING_CALLBACK_SECRET=<random-long-value>
AFRICASTALKING_BUSINESS_ID=<MartPoint business UUID>
AFRICASTALKING_FORWARD_NUMBERS=+2348012345678
```

`AFRICASTALKING_CALLBACK_SECRET` is mandatory. Append
`?secret=<random-long-value>` to each Africa's Talking URL below. Missing or
incorrect secrets are rejected; do not remove authentication to fix a 403.

## Dashboard URLs

```text
Voice callback:   https://<production-domain>/api/africastalking/voice/callback
Voice events:     https://<production-domain>/api/africastalking/voice/events
USSD callback:    https://<production-domain>/api/africastalking/ussd
SMS callback:     https://<production-domain>/api/africastalking/sms
Airtime callback: https://<production-domain>/api/africastalking/airtime/events
```

For Voice, the callback returns XML and either plays the configured greeting,
collects a department choice, or forwards an inbound call to the configured
mobile/SIP number. The events endpoint reconciles each destination attempt, so
busy/no-answer/failure can fall through to the next configured destination. The
recording endpoint copies voicemail audio into the private `azera-voicemails`
bucket when the provider recording URL is downloadable. For SMS, inbound
messages are filed into an Azera SMS conversation. USSD currently provides a
safe support/callback menu and Airtime stores the delivery payload for later
reconciliation.

## Admin settings

### Recording-choice loop repair (migration 139)

Apply `139_voice_recording_consent_flow.sql` before deploying the repair. The
pending recording step is stored on the call, not inferred from a department
digit or dependent only on `?stage=recording-consent`. The dedicated
`/api/africastalking/voice/consent` action uses the same callback authentication.
Do **not** set it as the virtual number's main callback: GetDigits uses it
automatically. Keep the main Callback/Events URLs as documented below.

Press 1 saves explicit consent; press 2 continues on the same selected route
without recording. Silence/timeout also continues without recording through a
Redirect after GetDigits (AT does not call callbackUrl when no input arrives).
Duplicate or late responses cannot overwrite a stored choice or redial an
already connected call. Existing call history is not backfilled as consent.
GetDigits input delivered to the Events URL for a pending native incoming call
is also handled as a voice action and returns XML, rather than being ignored
with a JSON status acknowledgement.

Webhook diagnostics now insert exact-delivery fingerprints, preserving
different keypresses within one Ringing session. Duplicate inserts use the
existing partial unique index; PostgREST upsert on just `dedupe_key` could not
infer that partial index. No production call or diagnostic data is deleted.

Retest the 020 line after deployment with 1, 2, no input and a department choice
followed by 2. Confirm the same selected destination rings, the prompt does not
loop and only explicit consent allows `Dial record="true"`. Until deployed,
local passing tests do not change the live telephone line.

### Browser phones and the production callback (migration 137)

Apply `137_africa_browser_agents.sql` after 136 and deploy the Next.js changes.
No SIP password, VPS or LiveKit subscription is required for this browser path.
Africa's Talking must activate Voice/WebRTC for the live application/number;
normal provider telephone charges still apply.

In Admin → Azera Settings → Phone Calls, use **Copy callback URL** and **Copy
events URL**. These are absolute production URLs with the required secret,
not links to open as webpages. Paste them into Africa's Talking **Voice →
Phone Numbers** for the virtual number, replacing `/test/voice`:

```text
Callback: https://www.martpoint.com.ng/api/africastalking/voice/callback?secret=<Vercel AFRICASTALKING_CALLBACK_SECRET>
Events:   https://www.martpoint.com.ng/api/africastalking/voice/events?secret=<same secret>
Recording:https://www.martpoint.com.ng/api/africastalking/voice/recording?secret=<same secret>
```

Set `NEXT_PUBLIC_BASE_URL` to the canonical HTTPS production origin if it differs.
Do not paste secrets into chat, tickets or public documents. The copy controls
are restricted to settings-authorised staff and never return the AT API key.
The code does **not** update your provider dashboard or Vercel settings itself.
If the SIP provisioning screen shows `Events: N/A`, configure the virtual
number's events URL where available; final `isActive=0` notifications posted to
the callback are also reconciled without restarting the IVR.

Staff use the **phone button in the admin header** → select Sales, Support,
Onboarding or General enquiries → **Enable browser phone**. Grant microphone
access. The phone remains mounted during admin navigation. The tab must stay
open; a closed/sleeping browser cannot be promised incoming calls. A second tab
cannot take over a fresh phone lease. Availability expires after 60 seconds
without a successful heartbeat. A failed SDK registration is never advertised
as ready. The receiving token renews while idle; provider expiry during an
active call is surfaced as a disconnection, not silently claimed as connected.

The callback routes the selected department to an available registered agent,
then tries the department's configured telephone/SIP fallbacks sequentially.
Department names/keys containing Sales/Demo map to Sales; Support/Tech to
Support; Onboarding/Billing to Onboarding. Other names and a menu-disabled
default route use General enquiries. Set appropriate business hours and keep
offline/no-answer greetings or voicemail configured. One agent is reserved
atomically per inbound call; other calls skip busy agents. The existing seven
SIP accounts may still be used in softphones or as fallback destinations, but
are not the credentials for this browser phone.

For an outgoing browser call, the provider sends `clientDialedNumber` and the
browser identity `applicationUsername.clientName`. The callback validates the
server-prepared call/contact, binds the provider session and returns `Dial` to
that stored destination only. It does not play the incoming IVR, accept an
arbitrary dial destination, or create a second inbound record. Incoming browser
identities use the documented `username.clientName` destination syntax. See
[AT WebRTC usage](https://developers.africastalking.com/docs/voice/webRTC_client/usage).

Production acceptance checks (not replaced by automated tests):

- Outgoing contact call: two-way audio, correct caller ID, single call history,
  correct final duration/cost from provider events; no IVR loop or FaceTime.
- Incoming virtual-number call: select each department, receive and explicitly
  answer/decline in Azera; verify two-way audio, mute/hold/keypad and history.
- Busy/offline agent and closed browser: next available agent or configured
  fallback/no-answer handling; never show an offline agent as connected.
- Duplicate/late provider events and final notifications sent to Callback:
  no redial, duplicate history or regression from active back to ringing.
- Test Chrome, Android Chrome and iOS Safari with microphone/autoplay
  permissions, and token expiry/failed network recovery.

Cloudflare remains the separate website-visitor-to-agent media path, not a SIP
registrar or a required intermediary for Africa's Talking telephone calls.

In Admin → Azera → Settings → Phone Calls:

1. Select `Africa's Talking`.
2. Enter the API key and username for outbound calls.
3. Enter the Africa's Talking virtual number.
4. Enter the mobile/SIP destination(s) that should answer calls.
5. Set the main, connecting, and no-answer greetings.
6. Set the timezone, weekly hours, and closed dates if the business should use
   after-hours handling.
7. To route by department, enable the department menu and add rows with an
   explicit digit, department name, primary destination, and optional fallback.
   Digits 1–8 are available; 9 repeats the menu.
8. Enable voicemail if missed calls should leave a message. The admin voicemail
   endpoint returns short-lived signed links only for authenticated Azera users.

The department menu is optional. If disabled, the general `Answer calls on`
numbers are dialled directly. If enabled, the department numbers are used for
the selected option. Keep one primary number per department where possible;
several destinations can still increase spend. The callback uses sequential
dialling so the next destination is attempted after the previous one, rather
than ringing every destination at the same time.

The `Dial` XML supports sequential routing and optional `ringbackTone`. Africa's
Talking does not expose a documented ring-timeout attribute in the installed
Voice XML builder; `maxDuration` is a connected-call limit, not a ringing limit.
The application therefore does not send an unsupported `timeout` attribute.
Provider event callbacks remain the source of truth for busy, rejected,
no-answer, and failed attempts.

Audio URLs are optional and must be HTTPS URLs reachable by Africa's Talking.
Use WAV or MP3 files only. A URL can be used for the main, connecting,
no-answer, after-hours, or ringback audio; the UI still uses text-to-speech when
no audio URL is configured. The settings screen can upload, preview, replace,
or remove these audio references. The application does not create synthetic
promotional audio or expose voicemail files publicly.

## Sales softphones

For the seven provisioned staff accounts, follow the
[MartPoint SIP setup guide](./azera-sip-setup-guide.md). It covers the working
Linphone UDP configuration, department fallbacks, deployment checks and the
distinction between SIP registration and Azera browser outbound calling.

For a sales team, request or map Africa's Talking SIP destinations for the
agents, then configure each destination in a SIP client such as Zoiper or
Linphone using the SIP username, password, domain and transport details
provided by Africa's Talking. Their setup guidance specifically supports
softphones such as Zoiper and X-Lite.

Put the SIP destination in the department field instead of a mobile number,
for example:

```text
Sales | sales-agent@youraccount.sip.africastalking.com
```

The caller still reaches the Africa's Talking virtual number, but the sales
agent answers in the SIP app over the internet. This avoids forwarding every
call to a normal mobile line. If Africa's Talking provisions a SIP trunk to a
PBX instead, the number callback is configured as `trunk:HOST_OR_IP`; that is
a separate PBX deployment and is not required for individual softphones.

The migrations `124_africastalking_webhooks.sql`,
`125_africastalking_voice_ivr.sql`, and
`126_africastalking_voice_workflows.sql` must be applied before saving the new
per-business Voice routing fields or receiving callbacks. Migration 126 creates
attempt, voicemail, and dedupe storage and a private voicemail bucket.
If an older installation reports that `ai_voice` is missing, apply
`127_ensure_azera_ai_voice_settings.sql` as well; it repairs the skipped AI
voice columns and reloads the PostgREST schema cache.

Configure these exact callback URLs in the Africa's Talking dashboard:

```text
Voice callback:   https://<production-domain>/api/africastalking/voice/callback?secret=<secret>
Voice events:     https://<production-domain>/api/africastalking/voice/events?secret=<secret>
Voice recording:  https://<production-domain>/api/africastalking/voice/recording?secret=<secret>
```

Use the public `www` production hostname if that is the hostname Africa's
Talking reaches without a redirect. The callback secret is server-only; it is
safe to include it in the provider dashboard URL but never in client-side code.

## Smoke test

After deployment, send a form-encoded test to the Voice callback. It should
return `Content-Type: application/xml` and a `<Response>` document:

```bash
curl -i -X POST \
  'https://<production-domain>/api/africastalking/voice/callback?secret=<secret>' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'sessionId=test-session&callerNumber=%2B2348011111111&destinationNumber=%2B234201111111&callSessionState=Active'
```

Then confirm the request exists in `africastalking_webhook_events` and the
call exists in `azera_calls`.

