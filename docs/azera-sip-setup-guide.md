# MartPoint SIP setup and live-call checklist

Use this guide for the seven Africa’s Talking accounts: three Sales, three
Support and one Onboarding. SIP softphones and Azera’s browser phone are two
different ways for staff to answer calls. Neither requires a VPS or LiveKit.
Africa’s Talking activation, balance and telephone charges still apply.

## 1. Register each staff member in Linphone

Open Linphone → **Third-party SIP account**. Give each staff member their own
account from Africa’s Talking → Voice → Phone Numbers. Never paste passwords
into chat, email guides or the Git repository.

| Field | What to enter |
| --- | --- |
| Username | The username provided for that specific SIP account. Keep the format that already registered successfully. |
| Password | That SIP account’s password, not the Africa’s Talking API key. |
| Domain | `ng.sip.africastalking.com`, as provisioned for your working account. |
| Display name | A readable name, such as “MartPoint Sales — Agent 1”. |
| Transport | **UDP** for these accounts: you confirmed it registers successfully. TLS did not work with the configuration tested. |
| Authentication ID | Leave blank unless the provider supplies a separate authentication ID. |
| Registrar / outbound proxy | Preserve working values; otherwise use only values explicitly supplied by the provider. |

If Linphone asks for a complete SIP address instead of separate username and
domain fields, use the complete address supplied by Africa’s Talking. Do not
change an already working username just to match an example.

Press **Connection/Login** and confirm the account shows registered. Repeat
with a different account on each staff device. Registration proves login only;
it does not prove incoming routing or two-way audio. UDP is not an encrypted
transport; ask Africa’s Talking for supported TLS/SRTP settings if encrypted SIP
signalling/media is required. Do not guess ports or disable certificate checks.

Provider references: [Africa’s Talking SIP setup](https://help.africastalking.com/en/articles/1163043-how-do-i-set-up-my-sip-phone)
and [Linphone third-party account login](https://www.linphone.org/en/docs/login-sip-account/).

## 2. Deploy MartPoint before testing the repaired call flow

1. Wait for the latest **production Vercel deployment** to show Ready.
2. Ensure migrations 137, 138, 139, 140, 141 and 142 have been applied after
   their predecessors. Migration 137 enables browser-agent routing; 140 stores
   outbound campaign state; 141 adds explicit voice-agent assignments; and 142
   adds the transfer-control request table.
3. Confirm the production Africa’s Talking username, API key, virtual number,
   business ID and callback secret are configured. Do not expose these values.

Linphone registration itself does not need a MartPoint deployment. The repaired
IVR, recording-choice handling and browser routing do.

## 3. Set the virtual number’s production callbacks

In Admin → Azera Settings → Phone Calls, use **Copy callback URL** and **Copy
events URL**, then paste them into the Africa’s Talking virtual number’s
settings, replacing the default `/test/voice` callback.

| Provider field | Production path on `https://www.martpoint.com.ng` |
| --- | --- |
| Callback | `/api/africastalking/voice/callback?secret=<configured-secret>` |
| Events | `/api/africastalking/voice/events?secret=<configured-secret>` |
| Recording callback, where available | `/api/africastalking/voice/recording?secret=<configured-secret>` |

Use the actual secret-bearing URLs copied from the settings screen, not these
placeholders. Keep them private. If an individual SIP account shows Events N/A,
configure events on the virtual number where available. Do not replace the main
callback with the consent action URL or a Cloudflare SFU URL.

## 4. Route departments to the seven SIP accounts

In Azera Settings → Phone Calls, enable the department menu. Copy each account’s
**complete SIP destination** from Africa’s Talking; do not enter only its display
name or a guessed username. Use the department’s primary and fallback fields.

| Menu digit | Department | Suggested SIP routing order |
| --- | --- | --- |
| 1 | Sales and demos | Sales 1, then Sales 2, then Sales 3 |
| 2 | Technical support | Support 1, then Support 2, then Support 3 |
| 3 | Billing and onboarding | Onboarding 1 |
| 9 | Repeat menu | Reserved for repeating the department menu |

Set business hours, timezone, after-hours destination and no-answer/voicemail
handling deliberately. Outside business hours, the configured after-hours route
may apply instead of the department menu.

**Routing priority:** for a department the configured SIP/telephone
destinations are tried in their saved order first; an available Azera browser
agent is the final fallback. General/default routes continue to prefer an
available browser agent. Fallbacks are sequential, not a promise that all
three softphones ring simultaneously.

The virtual number callback returns the SIP dial instructions, as described in
[Africa’s Talking’s incoming SIP guide](https://help.africastalking.com/en/articles/5947707-how-do-i-receive-calls-on-my-sip-phone-or-any-ip-phone).

## 5. Browser calling versus SIP outbound calling

For Azera’s browser phone, an administrator first assigns queues in **Admin →
Azera → Voice Agent Assignments**. Staff then use the phone button in the admin
header, review their assigned queues, enable the phone and grant microphone
permission. They cannot self-select another department. Keep the tab open.
This uses server-issued WebRTC capability tokens, **not SIP passwords**.
Use Azera’s contact-call action for the implemented browser-to-customer outbound
workflow. Cloudflare handles the separate website-browser-to-agent media path.

Outbound calls dialled directly from Linphone are **not verified or implemented
by this incoming-IVR configuration**. They need Africa’s Talking’s SIP-originated
outbound callback setup and destination/caller-ID validation. Do not point a SIP
outbound callback at the incoming IVR and assume it can dial arbitrary numbers.
See the provider’s [outbound SIP requirements](https://help.africastalking.com/en/articles/5947735-how-do-i-make-outbound-calls-from-my-sip-phone-or-any-ip-phone).

## 6. Run an Azera follow-up campaign

After the Next.js deployment is Ready and database migration **140** has been
applied, open **Admin → Omnichannel → Call Campaigns**. Choose estimate
follow-up, expired-quote follow-up or older-enquiry re-engagement; set the
minimum enquiry age and a call cap; review the masked audience preview; save a
draft; then use **Start** only when ready to place real calls.

Keep the virtual number’s Callback and Events URLs from Section 3. Campaign
calls are correlated through Africa’s Talking’s `clientRequestId`; no new
provider callback path or SIP password is needed. The production API key,
application username and caller number must be configured in Azera Settings.
The first eligible call is dispatched when Start is confirmed; later calls
are paced by the existing five-minute Vercel worker, with only one Azera
campaign call active at a time. Calls respect the configured voice business
hours and may incur Africa’s Talking charges.

The current campaign is an automated spoken introduction plus keypad choices,
not a free-speech AI conversation: **1** asks the team to follow up, **2** asks
for a call back, and **3** opts the number out of future automated campaigns.
Responses and call notes appear in the selected campaign. Do a small internal
test first and check both Callback and Events delivery before selecting a larger
audience.

## 7. Test the 020 line

Use a separate phone as the caller and a registered staff softphone as receiver.

- Select each department and check that the intended staff account rings.
- On separate calls, press **1** to allow recording and **2** to continue without
  recording. Both must proceed to the selected destination without repeating
  the consent prompt indefinitely. No input must continue without recording.
- Confirm audio in both directions, mute, keypad input and clean hang-up.
- With a primary softphone offline/busy, check the configured fallback and
  no-answer handling. Separately test after-hours routing.
- Check call history and provider events for the correct final status and
  duration. Recording is allowed only after explicit consent.
- Separately test Azera browser answering and outbound contact calling, including
  microphone permission, caller ID and two-way audio.
- Assign only one test user to each queue, verify the incoming card shows the
  right queue, then test Transfer to an online agent in another queue. Test the
  Conference button only after Africa's Talking confirms the account's conference
  setup and room semantics; otherwise it remains guarded and reports that it is
  not enabled.
- Leave a voicemail and verify it appears in **Admin → Azera → Voicemails**, is
  playable, can be assigned and is removed after the configured retention period.

Automated tests do not establish carrier connectivity, audio quality, provider
charges or successful live recording. Those require these real-call checks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Registration fails | Keep the working UDP configuration; verify that account’s credentials and provider-supplied host/transport. |
| Registered but no ringing | Virtual-number callbacks, exact SIP destination, hours, department selection and browser-agent routing priority. |
| Consent prompt repeats | Confirm migration 139 and the new production deployment; inspect callback/events diagnostics for the keypress and consent action. |
| One-way/no audio | Microphone/audio devices, network/NAT and the provider’s media requirements. Ask support for the exact RTP/transport requirements; do not disable the firewall wholesale. |
| Direct Linphone outbound fails | SIP outbound needs its own provider callback workflow; use the implemented Azera browser outbound route meanwhile. |
