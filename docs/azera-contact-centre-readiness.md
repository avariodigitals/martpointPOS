# Azera contact-centre readiness — 24 October 2026

**Conclusion: not yet a complete, production-verified contact centre.**
Code, configuration and an end-to-end operational check are different things.
The inspection below read configuration-presence flags only: no credentials
were printed and no calls, messages or configuration writes were performed.

| Capability | Current evidence | Remaining work |
| --- | --- | --- |
| Website chat, AI text replies, human handoff, tickets | Implemented; Omnichannel has assignment, presence, queue labels, attachments and ticket actions | Validate operational scenarios with real staff; a queue label is not a full workforce/ACD system |
| Website browser-to-browser support calling | Implemented with microphone handling, signaling, audio and lifecycle tests | TURN relay setup and consented multi-device/network checks remain required |
| Incoming telephone IVR | Africa’s Talking provider credentials and caller ID are present; menu enabled with three departments | Verify number provisioning, callback URLs/secrets and actual inbound call delivery with the provider |
| Routing, backups, hours, busy handling and voicemail | Implemented; menu, schedule and voicemail flags are enabled | Confirm each primary/backup route, holiday/closed-hours branch and voicemail delivery end to end |
| Browser-to-telephone outbound calling | Implemented locally through LiveKit/SIP; not a `tel:` shortcut | LiveKit API credentials and SIP login/caller settings are missing; cannot certify live calls yet |
| Messenger and Instagram inbox | Inbound webhook code exists; account IDs are absent in the inspected settings | Configure provider accounts/webhooks and verify delivery |
| Replies from the unified inbox to social channels | The unified messages POST currently stores a database message; it does not call a social provider | Wire channel-specific dispatch, provider failures and real delivery/read receipts. A separate WhatsApp sender exists, but the unified reply route does not invoke it |
| Recording and call history | History/report screens and recording-reference APIs exist; voicemail has its own recording callback | Automatic two-party call capture, consent/retention policies and recording playback are not verified as a complete pipeline |
| AI voice | Enabled in settings, with a separate speech-processing endpoint | An enabled flag does not make the website phone button a continuously listening AI voice agent; the public call flow remains human support |
| Advanced call controls and supervision | Current browser controls cover answer, decline, mute and hangup | No complete integrated hold, attended/blind transfer, supervisor listen/whisper/barge or skills-based distribution was found in the inspected call paths |
| Reporting and service levels | Basic counts, statuses, durations, history and filters exist | Full SLA/answer-time/abandonment reporting, supervision and operational monitoring are not complete |

## Inspected implementation points

- `components/admin/omnichannel-inbox.tsx` and `app/api/azera/conversations/[id]/messages/route.ts`
- `app/api/azera/presence/route.ts`, `app/api/azera/calls/**` and `lib/azera-call-access.ts`
- `app/api/africastalking/voice/{callback,events,recording}/route.ts` and `lib/africastalking.ts`
- `app/api/azera/webhook/{messenger,instagram}/route.ts`
- `app/api/admin/whatsapp/send/route.ts` and `app/api/webhooks/whatsapp/route.ts`
- `app/api/azera/call-recordings/route.ts`, `app/admin/(protected)/azera/reports/page.tsx`
- `app/api/azera/voice/[callId]/route.ts`

The department form repair is presentation-focused: full-width phone settings,
container-responsive route cards, explicit labels, bounded inputs, multiline
backups and stable row identities while editing. Existing routing values and
the API's saved department shape are preserved.
