# Manual email composer

Lead, partner and creator application emails offer **Normal email** and **Branded card** styles. Normal email is the default in the composer: a white page with the staff member's signature, the configured MartPoint contact footer, social links and footer banner. Branded card retains the blue header and card. Automated emails keep their existing layouts.

The rich editor supports paragraphs, headings, bold, italic, underline, lists, quotations, links, undo/redo and clearing formatting. Links are edited inside the composer. Preview and Send share the same layout and personal signature. Changing styles preserves the message.

Each signed-in staff member can set their own signature from **My Profile → Email signature → Save signature**. A default template fetches the profile name, role, email and phone, plus the company name from Settings. Users edit plain fields and optional additional lines; the application generates safe HTML with clickable phone and email links. The personal phone field is saved to the user profile. Editing the display title does not change the account's role or permissions. The signature is used for lead, partner, creator and support correspondence.

Apply `supabase/migrations/153_user_signature_templates.sql` for profile phone storage and editable templates. Users with no saved signature receive a profile-based default automatically. Existing custom HTML signatures are preserved; **Use profile template** replaces one only after saving. Customer Care and Tech accounts use **Admin Settings → Contact Information → Support Phone Number**, falling back to the configured Phone Number when empty. The server resolves that shared number for every preview and send, so later settings changes apply without each user resaving their signature.

For lead replies, **Reply all** displays every To and Cc address in wrapping fields above the message. The same recipient calculation runs on the server. Our own sending mailboxes and duplicate addresses are excluded; Bcc recipients are not available from a received message. A regular Reply displays the sender without adding Cc recipients. Attachments still work with either style.

## Saved drafts

Apply `supabase/migrations/152_email_composer_drafts.sql` to enable **Save draft**, **Restore draft** and **Delete saved draft**. Each staff account has one private draft per lead, partner or creator application. Drafts contain the subject, HTML formatting, email style, partner recipient, reply context and selected lead attachment bytes. They can be restored after closing the composer or signing in on another device.

Saving never sends an email. Restore is explicit so a slow draft load cannot overwrite a message being typed. Successful sends remove the saved draft; failed sends retain it and the current message. Draft APIs require the permission used to compose that entity's emails and restrict every operation to the signed-in user. The table is accessible only through the service role.
