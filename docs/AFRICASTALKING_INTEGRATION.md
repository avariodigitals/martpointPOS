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

When `AFRICASTALKING_CALLBACK_SECRET` is set, append
`?secret=<random-long-value>` to each Africa's Talking URL below.

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
mobile/SIP number. The events endpoint updates `azera_calls` and adds an audit
row. For SMS, inbound messages are filed into an Azera SMS conversation. USSD
currently provides a safe support/callback menu and Airtime stores the delivery
payload for later reconciliation.

## Admin settings

In Admin → Azera → Settings → Phone Calls:

1. Select `Africa's Talking`.
2. Enter the API key and username for outbound calls.
3. Enter the Africa's Talking virtual number.
4. Enter the mobile/SIP destination(s) that should answer calls.
5. Set the Voice greeting and No-answer greeting.
6. To route by department, enable the department menu and enter one department
   per line using `Department name | +234number,+234fallback`. Callers are
   asked to press 1–9 in the same order as the lines.

The department menu is optional. If disabled, the general `Answer calls on`
numbers are dialled directly. If enabled, the department numbers are used for
the selected option. Keep one primary number per department where possible;
several destinations can still increase spend. The callback uses sequential
dialling so the next destination is attempted after the previous one, rather
than ringing every destination at the same time.

## Sales softphones

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

The migrations `124_africastalking_webhooks.sql` and
`125_africastalking_voice_ivr.sql` must be applied before saving
the new per-business Voice routing fields or receiving callbacks.

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

