# Next.js communications workspace

The workspace is available at `/admin/communications` to staff with both
Marketing and Leads access. Email uses the configured Resend or Brevo sender;
SMS defaults to the same BulkSMSNigeria v2 provider as the PHP application.
Africa's Talking can also be selected. Sends go directly to the provider
account; this feature has no MartPoint credit or wallet dependency.

## Rollout

1. Apply `supabase/migrations/161_communications_workspace.sql` after migration
   160. It creates the templates, workflows, queue, opt-out list, and links
   Azera conversations to leads. New workflows are disabled by default.
2. Set `CRON_SECRET` in Vercel. The project cron calls
   `/api/cron/communications` every five minutes with a bearer token.
3. In Communications → Settings, choose BulkSMSNigeria, enter its approved
   sender ID and API token, then save. The token is stored in the protected
   settings row. Alternatively set `BULKSMSNIGERIA_API_TOKEN` and
   `COMMUNICATION_SMS_SENDER` in the environment. The optional Africa's Talking
   setting reuses the existing voice credentials when its API key and username
   fields are blank.
4. Configure the selected email provider and current MartPoint AI providers in
   their existing settings pages. No duplicate AI account is introduced.
5. Enable a workflow only after reviewing its channel, template or AI purpose,
   first delay, interval, and maximum number of messages. Choose automatic
   dispatch or approval for every individual workflow. An approval workflow
   stores the exact prepared message in History and will not send it before a
   staff member approves it.

Set `COMMUNICATION_SMS_CALLBACK_SECRET` to a long random value and configure
the SMS delivery callback as `/api/communications/sms/delivery?secret=<value>`
when the provider account supports delivery callbacks. Callback reports update
accepted messages to delivered or failed. Africa's Talking inbound SMS already
uses `/api/africastalking/sms`; its existing callback secret protects that
route. STOP, UNSUBSCRIBE, CANCEL, END, and QUIT are persisted as SMS
suppression records before the inbound webhook acknowledges them.

## Conversation-aware AI

For each preparation, AI receives the complete available lead profile and
chronological linked email, SMS, and Azera chat history. Email history is read
from `lead_emails`; SMS sends and inbound chat/SMS entries are included when
linked to that lead or safely matched to its unique phone number. More than
10,000 entries or 100,000 serialized characters fails closed for staff review;
history is not silently truncated. The prompt treats conversation text as
untrusted evidence and forbids invented pricing, promises, and disclosure of
internal notes. The exact draft, provider/model, and skip reason are retained.

Each outbound request has a stable message ID. Queue claims are atomic, and an
interrupted provider dispatch is marked unknown rather than resent. Staff
should check the provider dashboard before manually retrying an unknown result.
Provider acceptance is not proof of final handset or inbox delivery.

The message worker requires an active staff account with Marketing and Leads
access. It rechecks lead status, opt-outs, conversion, workflow state, and the
latest inbound/outbound history immediately before dispatch.
