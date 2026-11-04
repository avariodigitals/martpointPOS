# Invoice messaging, approvals and access control audit

Scope: Next.js app in `martpointPOS`. This is an implementation audit, not a claim that the workflows have passed end-to-end acceptance.

## Implementation status

- Implemented a manual invoice SMS reminder action that uses an existing SMS template, shows a rendered preview, honors SMS opt-outs, records delivery through the existing provider and writes an audit event. It is never scheduled automatically and can be sent even when the scheduled reminders are paused.
- Implemented configurable approval policies for invoice cancel/void/waive, payment confirm/reverse, subscription waive/suspend/cancel, commission approval and payout mark-paid. Policies support role and individual approvers, a request inbox, requester/approver separation, required reason capture, entity-state revalidation and audit events. Invoice cancellation, payment reversal, subscription waiver/cancellation and payout mark-paid are enabled by default; other policies are optional.
- Added per-user allow/deny permission overrides on top of shared role permissions. Deny takes precedence; individual approver assignment also grants access to the approval inbox. Admin API routes with custom role checks now consult effective permissions, as do finance actions, search and automation dispatch.
- Added migrations `167_approval_workflows.sql`, `168_user_permission_overrides.sql` and `169_invoice_scoped_automation.sql`. Apply them in order before using these features.

## Current state

- Invoice email reminders have a manual `send_reminder` action and a separate daily email sweep. The invoice record can pause/resume the automatic reminders. The daily sweep currently sends email only.
- SMS templates and SMS provider delivery already exist in Communications. Invoice reminder sending does not currently select or render an SMS template, and there is no invoice-specific manual SMS action.
- The `invoice_unpaid` workflow now enrolls invoice IDs and resolves the current billing contact and invoice state when dispatching, so it works without a linked source lead. An enabled invoice workflow owns the sequence and suppresses the legacy daily email sweep to prevent duplicate reminders. Workflow approval occurs after the exact template output is prepared and stored for review. Invoice SMS reminders remain explicit manual overrides.
- The other Studio triggers and legacy lifecycle email jobs remain as-is. The Studio is not yet a universal workflow engine for creators, staff, partners and general business lifecycle events; those require entity-aware enrollment, recipient resolution, stop rules and supported actions before they can be safely managed from one builder.
- The per-person override editor excludes Admin accounts; Admin remains a global superuser. Approval policy edits and personal permission edits are Admin-only.

## Approval candidates to evaluate

The following are high-impact or hard-to-reverse actions in the current Next.js app and should be assessed for configurable approval policies. Suggested policy should account for amount thresholds, requester/approver separation, reason capture, audit history and whether an action is reversible.

| Area | Action candidates | Initial recommendation |
|---|---|---|
| Finance | Cancel/void/reopen/waive invoices; reverse payments; approve/reject payment evidence; commission approval and payout; subscription waiver/cancellation | Approval policy candidates; prioritize invoice cancellation and payment reversal |
| Quotes | Correct an accepted quote's status; exceptional discounts; quote-to-invoice conversion when it changes committed value | Accepted quote correction already has a dedicated request table; inspect whether all other exceptional transitions need review |
| Customer/business | Create or materially change a business account, onboarding access, or commercial entitlement | Approval only for sensitive or financially consequential changes |
| Communications | Enable or change an automated customer-facing workflow; send an invoice SMS reminder | Keep SMS invoice reminders manual by default; require an explicit per-invoice send action |
| Admin/access | Grant elevated permissions, change roles, alter approval policies | Require a second approver for high-privilege grants and policy changes |

## Remaining approval candidates

Amount thresholds, dual approval, invoice reopen, payment-proof rejection, exceptional quote discounts/conversion, and approval of role or permission grants do not yet have configurable approval policies. Accepted quote status corrections continue through their existing dedicated request flow. These actions should be assessed separately before adding policy controls.

## Relevant implementation points

- Invoice API and cancellation: `app/api/admin/finance/commercial/[resource]/route.ts`
- Invoice reminders and scheduled sweep: `lib/invoice-emails.ts`, `app/api/cron/invoice-reminders/route.ts`
- SMS provider/template infrastructure: `lib/communication-sms.ts`, `lib/communications-policy.ts`, `communication_templates` and `communication_workflows` migrations
- Role-level and finance-level permissions: `lib/admin-types.ts`, `lib/finance-permissions.ts`
- Existing narrow approval precedent: `quote_status_correction_requests` in migration `145_quote_status_correction_approvals.sql`
