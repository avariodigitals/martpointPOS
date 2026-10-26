# Correct login links in access-details emails

The onboarding access composer previously generated a subdomain from the business
name and appended `/login`. That was not proof of the actual installed address.
The generated address has been removed.

## Sending or correcting access details

1. Open **Admin → Onboarding → Send/Resend access email** for the business.
2. The composer loads **Admin URL** from that business's deployment record. It
   does not substitute the public website, storefront or environment root for
   the login address, and does not invent a path.
3. If no deployment Admin URL exists, enter the actual installed login URL.
   A URL from a previous send is retained only as an unverified resend value.
4. Open the link, confirm it is the correct business login page, and check any
   store/support links. Tick the confirmation before sending. Changing a link
   resets the confirmation.
5. Check recipients and the editable email, then send. Previously emailed
   messages cannot be changed; resend corrected instructions where necessary.

The server validates HTTP/HTTPS syntax and rejects embedded credentials, missing
hosts, placeholders and local/private addresses. It requires confirmation on
every send, including resends. It does not fetch arbitrary customer URLs or
automatically transmit credentials while checking a link. Manual checking is
still required: valid URL syntax does not prove the correct tenant is behind it.

The labelled login address and occurrences of the previous saved login URL are
updated in the message. Login QR attachments use the same confirmed URL. Custom
paragraphs are retained, so review any independently typed links before sending.
No new migration is needed. No historical emails are resent automatically.
