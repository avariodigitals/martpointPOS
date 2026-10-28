# Fleet Live Chat recovery — 28 October 2026

This concerns **Ask MartPoint → Live Chat**, not the local Assist AI.

## Deploy both halves

1. Deploy the Next.js changes. Merchant polling now resolves authenticated PHP
   integer IDs to their canonical business UUID, returns an empty new chat
   without creating records, and renews expired conversation tokens. Ending a
   chat and uploading media use the same identity check. Private responses are
   not cached. A valid conversation token is still required for private access;
   a numeric ID additionally requires the authenticated PHP bridge.
2. Distribute these PHP files to a canary installation, then the fleet:

   - `application/controllers/Support_chat.php`
   - `application/libraries/Support_chat_transport.php` (new, mandatory)
   - `application/views/assist/support_chat_widget.php`
   - `application/views/support_chat.php`

   Keep PHP **7.4**. Back up the four target files first; do not deploy unrelated
   retail work. The controller normalizes old `martpoint.com.ng` configuration
   to `https://www.martpoint.com.ng`, including an old environment override.
   Do not overwrite the installation's existing private configuration or secrets.
3. Verify `AZERA_PHP_BRIDGE_SECRET` matches between Vercel and the PHP runtime
   (or the private `support_chat_bridge_secret` configuration). A plain `.env`
   file is not sufficient unless the hosting runtime loads it. Never expose the
   secret in JavaScript or paste it into chat. Missing/incorrect authorization
   is still rejected, not bypassed. Unmapped stores still need verified business
   identity; do not map unrelated stores to a common support account.

No database migration is introduced by the chat hotfix. The bundled support
workspace separately requires migrations **148 then 149** before use.

## Canary acceptance

In a signed-in merchant session, open Ask MartPoint → Live Chat. A new chat
should display its empty state without the outage banner. Send a labelled test
message, confirm receipt in the Azera admin inbox, reply, and verify the reply
appears in the merchant widget. Test ending and reopening a chat. If a user can
switch stores, verify each store retains only its own conversation/token.
Uploads still require agent approval; voice notes retain their existing flow.

The bridge refuses unexpected redirects instead of forwarding merchant tokens
to arbitrary hosts. It returns structured errors for timeouts/non-JSON output,
and logs only HTTP status/cURL error number. It does not log chat text, tokens
or shared secrets and does not automatically retry message sends.

## Emergency rollback

Restore only the backed-up PHP files if a canary fails; do not roll back user
data or database migrations. Keep the new library until no deployed controller
references it. Revert the corresponding Next.js commit through the normal
deployment workflow if necessary. Do not disable authorization to restore access.
