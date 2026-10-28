# Support ticket workspace

Apply migrations **148** and **149**, in that order, before deploying this change.
The follow-up endpoint uses the existing `CRON_SECRET` and is scheduled hourly
in `vercel.json`.

Every ticket has exactly one linked requester profile: lead, business, partner,
or creator. Contact name, email, and optional “on behalf of” remain separate
from the assigned support teammate. From Support Desk, select **New ticket**
and choose the profile. Each profile also has its own Support tickets panel
with a Create ticket link.

Azera tickets match the visitor’s email to a profile. A new visitor becomes a
support-origin lead. Existing website tickets filed under MartPoint Support
are relinked by migration 149 when the original chat contains a valid email.
Tickets without sufficient identity remain visible for staff to repair with
**Edit requester / profile link**; the migration does not invent an identity.

The workspace shows the current status, stage, assigned teammate and response
deadlines. Creation, messages and administrative changes are individual
expandable entries, newest first. The free Tiptap editor supports headings,
bold, italic, underline, lists, links, quotes, undo and redo. Replies allow up
to three attachments, each no larger than 3 MB (within Vercel's request limit
after encoding the upload).

## Main inbox and switching

`/admin/support` is the persistent support workspace. Its ticket sidebar stays
visible while the selected conversation changes. The selected ID is recorded
as `/admin/support?ticket=<id>`; old `/admin/support/<id>` links redirect to the
same ticket in this workspace. Legacy `?id=<id>` links are normalized, too.
Back/Forward restore the selected ticket.
Search and stage filters are available in the sidebar; Table view retains the
directory and its advanced filters. Profile-scoped links retain their filter.

Sender settings and the inbox load separately, once per workspace. Selecting a
ticket uses one authorized thread endpoint, with a bounded, in-memory cache
and hover/focus prefetch. Cached tickets appear immediately; an uncached ticket
shows a local placeholder, never the previous ticket's conversation. Cached
threads revalidate on revisit once 30 seconds old, and mutations force a fresh read. Drafts
and attachments stay with their original ticket. Switching is disabled while
sending or uploading. Browser reload clears this session-only cache and drafts.

Public replies and customer-visible ticket updates use the acting admin’s
current signature from their user profile. Internal notes never email the
requester. Automatic follow-ups reuse the resolving admin’s current signature,
falling back to the assigned admin and then the configured support signature.
The conversation records email acceptance or failure; **Email sent** means
the mail provider accepted it, not confirmed inbox delivery. Failed reply
emails can be retried from their conversation entry.

## Resolution and closure

1. **Resolve & ask for confirmation** marks the issue resolved and sends a
   confirmation link. The interface displays **Awaiting confirmation**.
2. “Yes” closes the ticket and sends confirmation. “Still need help” reopens
   it and alerts the support team.
3. With no response, a follow-up is emailed after three days.
4. After five days from the first accepted confirmation email, and at least
   two days after an accepted reminder, a final closure note is sent. Only
   after that note is accepted does automatic closure proceed.
5. Failed/missing email prevents unattended closure. New requester messages
   reopen a resolved ticket and cancel its closure schedule. Each resolution
   cycle invalidates earlier confirmation links.

The hourly job can run slightly after these deadlines. Jobs claim each ticket
before processing it; a concurrent customer reply prevents closure.

## Inbound email

Ticket emails use Reply-To `support@martpoint.com.ng`. To show replies in the
conversation, the configured IMAP mailbox must receive that address, or the
provider’s authenticated inbound webhook must forward it to
`/api/webhooks/email`. The existing Email Settings / inbox sync handles polling.
Replies are matched by ticket number or message reference **and** the recorded
requester address, and deduplicated by provider message ID. Email integration
still requires a live end-to-end check after deployment; no customer emails
are sent by the automated local tests.
