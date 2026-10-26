# Creator question response tracking

Open **Admin → Creators → Applications**. Use **Review replies** or the
**Question reply status** filter. Search, application status and pagination work
with the reply filters; filtering happens in the database before page limits.

The **Question replies** column shows rounds awaiting replies, replies needing
review, reviewed rounds, opened links, failed initial emails and the last reply
time. An applicant can have more than one question round, so these categories
can overlap. **View answers** opens their application's **Additional Questions**
panel directly, including private attachment links.

- **Awaiting reply:** the round is Sent; it has not been submitted.
- **Link opened:** the answer page was accessed, not proof a person read or
  completed it. Email scanners may also access links.
- **Reply needs review:** answers were saved successfully; staff have not yet
  marked the round reviewed.
- **Reviewed:** staff used **Mark Reviewed**. This does not approve the creator.
- **Initial email failed:** the initial send failed; inspect reminder attempts
  in the individual panel to check whether a later attempt succeeded.

Both the applications list and question panel refresh quietly every 30 seconds
while visible, and when the window regains focus. Manual refresh controls are
also available. A failed refresh is shown explicitly instead of claiming there
are no replies. Dates and times use West Africa Time.

## Submission alerts

New successful submissions generate bell notifications for active Admin and
Digital Marketer accounts (the current creator-application reviewer roles).
An internal email uses the existing **creator_application** email route, falling
back to the configured notification email through the shared notification
service. Ensure this recipient route and the email provider are configured.
The alert links to the exact application's question panel; it does not attach
private creator files or include answer-link tokens.

The Sent → Submitted transition is conditional: concurrent/retried submissions
cannot overwrite a saved response or each generate an alert. Pending reminder
scheduling is cleared when answers are saved. The application's approval status
is not changed. Bell/email delivery uses the existing best-effort notification
service; failures are logged and never discard an applicant's saved answers.
The tracker remains the source of truth if delivery fails.

Existing submitted rounds appear in the tracker immediately after deployment;
historical alerts are not sent retroactively. No new database migration is
required; the existing question-round, reminder and notification migrations
must already be installed. Production delivery and real attachment opening
still need a live acceptance test after deployment.
