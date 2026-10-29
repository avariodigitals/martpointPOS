# Partner email

Open **Admin → Partners → select a partner → Email**. The tab appears immediately after Overview for every partner, regardless of their capabilities.

Apply `supabase/migrations/151_partner_email_threads.sql` before using the tab. It adds private correspondence history and prevents duplicate send requests. It does not send any emails or change existing partner contacts.

Staff with partner view permission can read history. Sending and previewing require partner manage permission. Recipients must be the partner's saved contact email or an active/invited user belonging to that partner. Add missing addresses in Overview or Users.

The composer supports formatting, preview, the signed-in staff member's email signature and the standard MartPoint banner. Configure personal signatures in the existing staff email-signature settings. A missing signature falls back to the staff member's name and MartPoint Partner Team. Existing Email Settings determine the sender and email provider, including SMTP when selected. Reply-To is always `partners@martpoint.com.ng` and configured notification-route recipients are never appended. The recipient picker expands inside the form on mobile.

History records each attempt before sending, shows newest messages first and includes pending, provider-accepted, failed and received states. Provider acceptance is not delivery confirmation. Failed sends retain the draft for retry. After an uncertain network result, refresh history before retrying; an unchanged send request is deduplicated.

## Incoming replies

The partners mailbox must reach the existing IMAP importer or authenticated inbound email webhook. Creating the Email tab does not create or connect a mailbox.

- Existing IMAP configuration is under **Admin → Settings → Email → Lead Thread Mailbox** (also used for support and creator replies). Configure a mailbox receiving/forwarding mail for `partners@martpoint.com.ng`; preserve that recipient address. The existing email-sync cron imports replies automatically.
- Alternatively, configure provider inbound forwarding to `/api/webhooks/email` with `INBOUND_EMAIL_WEBHOOK_SECRET` authentication.
- Replies are linked by an outbound message reference plus matching sender, or a unique saved partner contact. Ambiguous addresses are not guessed. Repeated provider messages are deduplicated.
- New replies create an admin notification linking directly to the partner's Email tab. Refresh loads newly imported messages; older history can be loaded in batches.

Emails previously sent outside this tab are not automatically copied into its outbound history. Existing mailbox messages already marked processed by older sync runs are not re-imported.
