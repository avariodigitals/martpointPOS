# Business access emails: edit and resend

In Admin → Onboarding, expand the business and choose **Send access details**.
After a successful provider-accepted send, this becomes **Edit & resend access**.

- Recipient email address(es), subject, message, credentials, support/training
  details and an optional additional note can be reviewed and edited.
- Reopening uses the last successful snapshot, including immediately after a
  send without reloading the page. Labelled access fields update the message
  without discarding custom paragraphs; review the final message before sending.
- The extra note is appended once and stored separately from the main message.
- Only the explicitly chosen recipients receive these credentials; configured
  notification-route recipients are not silently added.
- Provider rejection leaves the editor open and does not change the last-send
  timestamp. A snapshot-save failure after acceptance is reported separately so
  staff do not resend merely to retry saving. An uncertain network result asks
  staff to check Email Logs before retrying.
- Provider acceptance is not proof of inbox delivery or that the client read it.
- Editing this email does **not** create users or reset account passwords.
- Uploaded file contents are not retained: reattach files on resend. Selected QR
  codes regenerate. New sends retain filenames as a reminder. Attachment errors
  block sending instead of silently omitting a requested file.
- Resends retain the existing first-send check-in guard: they do not restart the
  welcome/check-in sequence.

No schema migration is needed; the existing `onboarding.access_details` JSONB
column holds the snapshot. Older records lacking a snapshot must be filled in
once. Older last-send timestamps were not reliable evidence of provider success;
the new code only advances this field after provider acceptance.

Tests: access-email composition, mocked access route, and explicit-recipient
email dispatch. Browser QA uses synthetic records and simulated provider results;
it does not send real access credentials or emails.
