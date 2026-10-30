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

### Predictable greeting and department-menu order

During working hours the first request plays **Main greeting and menu** without
claiming a selection was missed. Only a real invalid reply or a GetDigits timeout
can produce a retry explanation. The initial prompt does not use up a retry;
zero retries means one prompt followed by the configured fallback/no-answer path.
The menu uses explicit action/attempt URLs and a Redirect for no-input handling,
following [AT's no-input guidance](https://help.africastalking.com/en/articles/5947754-dealing-with-no-user-response-in-get_digits-action).
Late menu callbacks cannot replace a selected department or become consent.

With the menu enabled: welcome/menu → selected department → recording choice,
if enabled → connecting message → destination. With the menu disabled: main
greeting → recording choice, if enabled → connecting message → destination.
After-hours forwarding plays the after-hours greeting before recording choice;
it does not play the working-hours menu. A caller already using the menu can
finish that journey if the clock crosses closing time during the call.
Audio greetings retain the same order; a retry explanation is not hidden by a
configured audio file. Menu fallback also requests consent before any recording.

### Recording-choice loop repair (migration 139)

Apply `139_voice_recording_consent_flow.sql` before deploying the repair. The
pending recording step is stored on the call, not inferred from a department
digit or dependent only on `?stage=recording-consent`. The dedicated
`/api/africastalking/voice/consent` action uses the same callback authentication.
Do **not** set it as the virtual number's main callback: GetDigits uses it
automatically. Keep the main Callback/Events URLs as documented below.

Press 1 saves explicit consent; press 2 continues on the same selected route
without recording. Silence or an invalid key repeats the consent prompt once;
if there is still no valid response, the call ends without recording or
transferring. A Redirect after GetDigits reports silence because AT does not
call callbackUrl when no input arrives.
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

Apply `137_africa_browser_agents.sql` after 136, then migrations 141 and 160,
and deploy the Next.js changes. Migration 160 enables simultaneous browser-agent
ring groups for inbound calls.
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

The callback rings every available registered browser agent assigned to the
selected department at the same time, together with that department's configured
telephone/SIP fallback destinations. The first person to answer gets the call;
the other browser agents are released. Calls skip agents already handling a
call or already ringing for another caller.
Department names/keys containing Sales/Demo map to Sales; Support/Tech to
Support; Onboarding/Billing to Onboarding. Other names and a menu-disabled
default route use General enquiries. Set appropriate business hours and keep
offline/no-answer greetings or voicemail configured. The selected queue must
match the caller's menu choice. Intended agents need an Online status on Admin →
Azera → Voice agents and must keep Receive calls enabled in an open tab. The
existing seven SIP accounts may still be used in softphones or as fallback destinations, but
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

### Incoming prompt order and deployment

With working-hours departments and recording enabled, the sequence is now:
**welcome → recording choice → department options → connecting → Dial**.
Consent 1/2 is consumed separately and cannot select Sales/Support. Silence or
an invalid key at consent repeats the prompt once, then ends the call without
transferring; silence at the department menu retries up to the configured
limit, then uses the default route/voicemail. The no-input Redirect is necessary
because AT does not post an empty GetDigits result.

Legacy combined greeting/menu text is split at the first option sentence. With
recording enabled, the separate options use text-to-speech so a combined welcome
audio file cannot play options before consent. Keep the recording notice to the
recording explanation and 1/2 instructions; adding “Welcome” there duplicates the
main welcome. Custom menu audio remains used when recording consent is disabled.

These are Next.js route-handler changes, not a database-only fix. Applying SQL
migration 139 does not deploy them: the updated Next.js build must reach the
production callback URL before a call to the public number can test this flow.
Check both Callback and Events URLs in the provider dashboard. The callback
must remain publicly reachable with its existing secret; never remove callback
authentication to troubleshoot input.

A recording import failure is retained as a retryable failed webhook, but the
carrier's terminal state is saved first so a finished call is not left ringing.
An “Unapproved provider recording host” error needs the provider's exact trusted
recording hostname verified and configured in AFRICASTALKING_RECORDING_HOSTS;
do not allow all hosts or disable the private-recording checks.
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

