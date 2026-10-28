# Creator contact workspace

Apply migration **150_creator_contact_history.sql** before deploying these
changes. No production migration, call, invitation or email is made by the
local verification workflow.

## Profile and application layout

- “Call creator” appears at the far right of the name row on both application
  and activated creator profiles. The existing browser phone still asks staff
  to review and initiate the call; opening a profile never dials automatically.
- Both screens have **Calls** and **Meetings** tabs. Applications retain
  **Application** and **Email**; activated profiles retain **Profile**.
- Additional Questions is immediately below Interviews in the wide application
  column. It is no longer in the narrow decision/AI sidebar. Scheduling lives
  in Meetings, accessible from the Interviews card and decision panel.

## Call audit

New creator calls persist a creator/application foreign key and their initiating
event before returning the callable browser capability. Historical calls are
backfilled only from unambiguous `call_initiated` source metadata. There is no
phone-number guessing, so manually dialled or otherwise unlinked historical
calls do not automatically appear here.

Call history combines the creator and original application, including calls
made before approval. It is newest first and paginated, with agent, timestamp,
provider status, talk duration, follow-up notes and a compact event log. The
full Azera call report remains available from each entry.

Summaries are staff-authored, not invented AI transcripts. Each summary stores
an outcome, author snapshot, author ID and server timestamp. The API appends
rather than overwrites entries, and the table grants the server only SELECT
and INSERT. Corrections are additional entries. Viewing requires both creator
and Azera access; adding summaries also requires creator management/review
permission. Every write rechecks the selected call's actual profile ownership.
Saving a summary does not change provider call status or create a follow-up task.

## Google Meet

Meetings uses the existing workspace Google OAuth/calendar connection configured
in **Settings → Google Meet**. Meeting management requires
`creator.interview.manage`; view-only staff can see history. The service creates
a fresh Calendar event and Meet conference using the existing server-side
`createMeetEvent` integration (Calendar `conferenceDataVersion=1`). See
[Google Calendar event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
Secrets and refresh tokens never reach the creator UI.

Staff enter date/time explicitly in Nigeria time (WAT), duration, title and
agenda. The saved meeting keeps the creator's application link, Google event
ID, join URL, host and status. New general meetings use Google invitations plus
a branded calendar-invite email with the logged-in user's signature and
Reply-To `creators@martpoint.com.ng`. Its provider acceptance/failure is shown
separately from whether the meeting itself was saved. “Accepted” does not prove
inbox delivery. Failed branded invitations must not prompt staff to book a
duplicate meeting; share the stored join URL and check Email Settings instead.

Google disconnection or failed Meet creation fails visibly instead of saving a
linkless online meeting. If database persistence fails after event creation,
the service attempts to remove the orphan Google event. Approved creators are
never moved back to Interview Scheduled by a meeting booking. A pending
applicant can explicitly choose an application interview in the same form;
that may advance their review stage. Both kinds remain in the shared history.

Live calendar invitation, join and call audio verification remain a post-migration,
authorized end-to-end check. Local tests mock Google, telecom and email services.
