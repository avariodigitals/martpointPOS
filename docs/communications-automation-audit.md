# Next.js communications automation audit

Reviewed 3 November 2026. Scope: the Next.js app in `martpointPOS`; no PHP app changes.

## Update, 4 November 2026

Invoice reminders now use invoice-scoped automation runs and resolve the customer's current billing email at dispatch, including businesses with no source lead. SMS remains a per-invoice manual action. Prepared invoice emails can be held for staff approval, and an enabled invoice workflow suppresses the legacy daily email sweep to avoid duplicate reminders. This closes the invoice-specific audience gap described below; the rest of the Studio remains lead-oriented except for service-status subscriber emails. It is not yet a universal workflow engine for all business, partner, creator and staff records.

## Current state

The Communications Automation Studio is not yet a company-wide workflow engine. Its workflow definition has a `trigger`, channel, template or AI mode, delay, repeat interval and approval flag. Its execution table, `communication_runs`, requires a `lead_id`, and the sender loads lead-specific context. The API also requires Lead permission and only supports manually enrolling leads. The visible canvas is therefore a Leads workflow builder, even though the channel layer has some broader campaign support.

Separately, many existing email automations already run outside that builder. They are initiated by application routes, status transitions, cron jobs, and service functions. They do not appear as editable workflows in Automation Studio.

## Existing automated email inventory

| Area | Trigger → current action | Where it lives | Studio status / guardrails |
|---|---|---|---|
| Leads | New enquiry submitted → send lead receipt and notify the team | `lib/process-lead.ts` | Not represented as a protected workflow in Studio. Keep the receipt immediate. |
| Leads | Estimate request submitted → send receipt and internal alert; queue 48-hour follow-up | `app/api/estimate/route.ts`, `lib/automations.ts` | A lead trigger exists in Studio; legacy follow-up remains separate. |
| Leads | Questionnaire sent → queue 48-hour reminders (up to 3); submission cancels reminders | `lib/lead-questionnaire.ts`, `lib/automations.ts` | Studio has `questionnaire_sent`; legacy reminders are still separately managed. |
| Leads | Quote sent/revised/declined/change requested → send quote or decision emails; quote sending starts a 48-hour reminder sequence (up to 3) | `app/api/admin/quotations/**`, `lib/automations.ts` | `quote_sent` exists in Studio; quote issuance and status decisions should remain protected. |
| Leads | Meeting booked/rescheduled/cancelled → send invite or confirmation/update; meeting booked can start a workflow | `lib/meeting-booking.ts`, `app/api/admin/leads/[id]/meetings/route.ts`, `app/api/meetings/[token]/route.ts` | Meeting triggers exist in Studio. Calendar/ICS notices should stay immediate. |
| Leads | Inbound email/SMS/WhatsApp → store correspondence and enqueue `lead_replied` | `lib/lead-emails-inbound.ts`, `app/api/africastalking/sms/route.ts`, `app/api/webhooks/whatsapp/route.ts` | A reply trigger exists, but its execution is still lead-only. Human response should take priority over another automated send. |
| Leads | Unpaid/overdue invoice → send staged reminders; enqueue `invoice_unpaid` where the invoice maps to a source lead | `lib/invoice-emails.ts` | Studio event is lead-context only. Invoice reminders need business/invoice context and finance safeguards. |
| Businesses | Access provisioned → send welcome/access email; then 30/60/90/120/180/270-day check-ins, anniversary and dormant-account nudges | `app/api/admin/onboarding/access/route.ts`, `lib/client-checkins.ts`, `lib/automations.ts`, `lib/email-templates.ts` | Existing lifecycle workflow is in the legacy engine, not Studio. Welcome/access details must remain immediate and protected. |
| Businesses | Invoice issued/payment received → send invoice and payment confirmation; due invoices get reminders | `lib/invoice-emails.ts`, `lib/payment-emails.ts` | Not a general workflow. Payment receipts and invoice documents are protected financial messages. |
| Businesses | Feedback requested → send customer feedback email | `app/api/customer-feedback/route.ts` | One-off action; could be offered as an optional workflow after a completed support/sales event. |
| Creators | Application received → applicant receipt and admin alert | Creator application routes and `lib/creator-notifications.ts` | Not in Studio. Receipt and internal alert should remain immediate. |
| Creators | Application/interview/assessment/onboarding state changes → send interview invite, approval/waitlist/rejection, assessment, onboarding, lesson/resource, challenge, submission, deadline, winner and reward messages | `lib/creator-notifications.ts`, `lib/creator-applications.ts`, creator admin routes, `lib/email-templates.ts` | Scattered state-driven automation. State decisions, credentials and reward/payment notices must stay controlled; announcements and reminders are good workflow candidates. |
| Staff / careers | Application received → applicant receipt and recruiter alert; status changes → under review, shortlist, assessment, interview, offer, reserve, rejection, deployment and talent-pool emails | `lib/careers-notifications.ts`, `app/api/careers/**`, `app/api/admin/careers/**` | Scattered state-driven automation. Interview/offer/selection messages need explicit authorized staff action and audit. Routine assessment/deployment reminders can be configurable. |
| Partners | Partner application received/status changed → applicant/admin emails; compliance requested/submitted/reviewed → applicant notices/reminders | `lib/partners.ts`, `lib/partner-compliance.ts`, `lib/partner-application-questions.ts`, partner application routes | Not in Studio. Compliance/legal state notices should be protected; repeat reminders can be configured with caps. |
| Partners | User invited/status changed/password reset; lead/prospect invited; payout requested/approved/rejected; installation handover → send the corresponding notice | `lib/partner-service.ts`, `lib/partner-leads.ts`, `lib/partner-notifications.ts`, partner admin routes, payout routes | Not in Studio. Auth, payout and handover messages must remain controlled and auditable. |
| Partners | Lead protection nearing expiry, certification nearing expiry, or work-order milestone due/overdue → send one reminder per record | `lib/partner-ops.ts` and partner ops cron | Existing scheduled automation outside Studio. Its sent-at fields provide idempotency; make timing/caps configurable without losing that protection. |
| Platform / support | Support magic link; support ticket updates and satisfaction follow-up; service status incident created/updated/resolved → send access, ticket or status emails | `app/api/support/auth/route.ts`, `lib/support-ticket-email.ts`, `lib/status-page.ts`; status rules in Communications | Status incident rules already appear in Studio; auth links and service notices must remain protected. |

This inventory covers transactional and lifecycle email paths found in the Next.js source. It is not a claim that every template is currently enabled or that every route sends on every status transition: some require an explicit admin action, configured recipient, scheduled job, or successful state change.

## What the Studio currently supports

Current workflow trigger options include new lead, no reply, manual enrollment, lead replied, unpaid invoice, meeting booked, questionnaire sent, quote sent, estimate requested, and service-status incident events. It can send email, SMS, WhatsApp, or create call tasks, with optional delay, repeated steps, approval, and reply-stop behavior.

Important gaps:

1. `communication_runs.lead_id` is mandatory, so a business, creator, staff applicant, or partner cannot be enrolled without being represented as a lead.
2. `prepareCommunication()` reads only lead profile and conversation history. It cannot safely resolve entity-specific facts such as a creator challenge deadline, staff assessment slot, partner compliance item, or invoice status.
3. The workflow editor/API permission gate requires lead access. There is no separate automation permission model for creator, staff, business or partner records.
4. Several event names exist without event producers for all business processes. A selectable trigger is useful only when its producer, entity context, and idempotent enrollment path are implemented.
5. The dedicated legacy reminder engine still sends questionnaire, quote, estimate and client check-in emails independently of the Studio. Editing a Studio flow today does not replace those legacy sends.

## Recommended workflow model: trigger → checks → action → stop rules

Every workflow should clearly show these stages:

1. **Trigger:** a real event or a scheduled condition (for example, partner certification expires in 30 days).
2. **Audience/entity:** the exact record type and recipient (Lead, Business, Creator, Staff applicant, Partner, or Status subscriber).
3. **Checks:** record still eligible, current state still matches, consent/suppression allows the channel, no duplicate run, and no newer human reply/action makes the message inappropriate.
4. **Wait:** delay, local time window, repeat interval, and a hard maximum attempt count.
5. **Action:** send a selected email template, SMS/WhatsApp, create a task, or notify staff. Show sender/reply-to, recipient, and rendered preview.
6. **Stop/branch:** stop on reply, conversion, completion, rejection/withdrawal, opt-out, or state change; optionally branch to a staff task.
7. **Audit:** show trigger event, resolved entity, message, provider result, retries/stops, and who configured or approved it.

## Suggested configurable workflow catalog

These are appropriate candidates for a unified builder once their entity events and safeguards are connected:

| Entity | Trigger | Suggested actions |
|---|---|---|
| Lead | New lead; estimate requested; quote sent; questionnaire awaiting response; meeting booked/no-show; inbound reply; stale conversation | Immediate owner/team notification, timed follow-up, call task, stop on human reply or closed lead. Keep quote/invoice source documents on their existing guarded actions. |
| Business | Onboarding access completed; invoice due/overdue; no login for configurable period; support case resolved; anniversary | Welcome/check-in/reminder/feedback email, account-manager task. Keep credentials, invoice issuance and payment receipt as protected transactional actions. |
| Creator | Application received; interview/assessment scheduled; onboarding incomplete; lesson/resource published; challenge deadline approaching; submission needs review | Receipt/notification, timed reminder, staff review task, opted-in announcement. Keep credentials and application decisions controlled. |
| Staff applicant | Application received; assessment/interview scheduled; assessment incomplete; deployment date approaching | Receipt, reminder, recruiter task. Require an explicit authorized status transition for interview, offer, selection, reserve or rejection. |
| Partner | Application received; compliance item outstanding; lead protection/certification/work order nearing due date; payout state changed | Acknowledgement, capped reminders, assigned-owner task. Keep password/auth, compliance decisions, payout decisions and handover protected. |

## Implementation sequence

1. **Catalog existing automations in the product:** show every existing email path as either a managed workflow, a protected system automation, or a one-time/manual action. Do not imply a workflow is editable until its producer is connected.
2. **Generalize execution records:** replace the lead-only run relationship with a validated entity type + entity ID, add per-entity context resolvers and unique idempotency keys, then preserve existing lead records during migration.
3. **Add event producers incrementally:** Businesses first (existing check-ins and invoice reminders), then Partners (existing due-date reminders), then Creators and Staff (state-driven reminders/announcements). Migrate each legacy sender only after the new path is proven to avoid duplicate mail.
4. **Add controls and observability:** per-entity permissions, preview/test recipient, approval rules, quiet hours, caps, stop conditions, audit history, failure/retry review, and duplicate-send protection.
5. **Keep protected messages outside arbitrary automation:** password/reset links, onboarding credentials, invoices/payment receipts, legal/compliance decisions, application decisions, payout decisions, and service-critical status messages retain their existing authorized transitions and fixed system templates. They can be visible in the catalog as protected automations.

## Decision for the UI

The Automation Studio should become a unified catalog with filters by entity and status (`Managed`, `Protected system automation`, `Manual action`, `Not connected`). Selecting a managed workflow opens the trigger → checks → wait → action → stop-rules canvas. Until the generalized entity runner exists, the UI must label the current Leads-only capability clearly and should not present unsupported entities as active workflow triggers.
