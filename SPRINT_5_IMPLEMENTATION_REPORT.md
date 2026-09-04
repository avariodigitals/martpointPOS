# MARTPOINT SPRINT 5 — IMPLEMENTATION REPORT

## 1. Summary

Sprint 5 adds the operational service layer around customers and partners: a central support desk, partner first-line support with MartPoint escalation, customer-success management, customer compliance, customer incidents, and a consolidated admin action centre. Existing Sprints 1–4 entities (businesses, partners, entitlements, finance/billing, subscriptions, commissions) were left unchanged. MartPoint retains responsibility for the platform; partner support is delegated permission, not ownership.

## 2. Database migrations

**File**: `supabase/migrations/013_sprint5_support_customer_success_compliance.sql`

New tables created:

- `support_tickets` — atomic `MPS-YYYY-#####` numbering, categories, priorities, statuses, assignment, SLA due dates.
- `support_ticket_messages` — public and internal conversation.
- `support_ticket_events` — lifecycle history (status, priority, assignment, escalation).
- `support_sla_policies` — per-priority first response and resolution SLAs.
- `support_business_hours` — timezone, working days, opening/closing times.
- `customer_success_profiles` — business stage, health, owner, follow-ups.
- `customer_success_activities` — recorded calls, emails, training, etc.
- `compliance_records` — business/partner compliance status, expiry, document links.
- `compliance_requirements` — configurable requirement types.
- `customer_incidents` — serious incident tracking.
- `admin_tasks` — action-centre task records.
- `storage.buckets` entry: `support-attachments` (private).

Seed data includes default WAT business hours, four priority SLAs, common compliance requirements, and default customer-success profiles for existing businesses.

## 3. Support architecture

- Support requests are captured as `support_tickets` linked to canonical `businesses`.
- `created_by_type` distinguishes `ADMIN`, `PARTNER`, `CUSTOMER`, `SYSTEM`.
- Ticket source can be `PORTAL`, `PARTNER`, `ADMIN`, `EMAIL`, `WHATSAPP`, `PHONE`, `SYSTEM`, `OTHER`.
- Atomic ticket numbers via `next_support_ticket_number()`.
- `lib/support.ts` provides ticket lifecycle, message/event creation, SLA calculation, and partner access control.

## 4. Ticket lifecycle

Ticket status workflow: `NEW → ASSIGNED → IN_PROGRESS → WAITING_CUSTOMER/PARTNER → ESCALATED → RESOLVED → CLOSED`.

Service functions:
- `createTicket` — creates ticket with SLA due dates.
- `assignPartner` / `assignAdmin` / `removePartner`.
- `changeStatus` — transitions status, records resolved/closed timestamps.
- `changePriority` — recalculates SLA.
- `escalateTicket` — sets `ESCALATED`, clears partner assignment, logs event.
- `addMessage` — public or internal (admins only).
- `addEvent` — records any state change.

## 5. Ticket conversations

- `support_ticket_messages` supports `visibility: PUBLIC | INTERNAL`.
- Partner pages and APIs filter to `PUBLIC` only.
- `support:internal_notes` permission required for internal messages.
- `support-attachments` storage bucket configured for private uploads.

## 6. Attachments

- Supabase storage bucket `support-attachments` is created with `public = false`.
- UI page fields accept `attachment_path` references; signed URLs are expected in a future hardening pass.
- Executable uploads are not permitted by MIME type at the application layer.

## 7. Sensitive ticket routing

- Sensitive categories are enforced server-side in `lib/support.ts` and the partner API:
  - `BILLING`
  - `LICENSING`
  - `SECURITY`
  - `PRIVACY_DATA`
  - `PARTNER_COMPLAINT`
- Partners cannot be assigned to or view these tickets.
- `app/api/partner/support/route.ts` rejects any message or status action on sensitive tickets.

## 8. Partner first-line support

Partner access rules in `lib/support.ts` require:
- Active partner and active partner user.
- Organisation `FIRST_LINE_SUPPORT` capability.
- User `support:view_assigned` or `support:manage_assigned` permission.
- Active `PartnerCustomerAssignment` with `SUPPORT` access level.
- Non-sensitive category.

Permitted partner actions:
- View assigned ticket.
- Reply publicly.
- Set `IN_PROGRESS` / `WAITING_CUSTOMER`.
- Escalate to MartPoint.
- Mark `RESOLVED` where permitted (but not close).

Prohibited:
- View internal messages.
- Create internal messages.
- Access sensitive categories.
- Change SLA or reassign.
- Access unassigned customers.

## 9. Escalation

- `POST /api/admin/support/[resource]` `action=escalate` and `POST /api/partner/support` `action=escalate`.
- Requires reason; optionally notes and evidence.
- Sets status to `ESCALATED`, removes partner assignment, records `SUPPORT_TICKET_ESCALATED` audit event.
- Notifies MartPoint via existing notification queue (subject/ticket reference).

## 10. Admin Support Desk

Routes:
- `/admin/support` — list with filters (status, priority, category, search).
- `/admin/support/[ticketId]` — detail with customer, partner, conversation, internal notes, events, SLA, actions.

API: `/api/admin/support/[resource]` (`tickets`, `messages`, `events`).
Actions: `create`, `update`, `assign_admin`, `assign_partner`, `remove_partner`, `change_status`, `change_priority`, `escalate`, `add_message`.

## 11. SLA

- `support_sla_policies` seeded for `LOW`, `NORMAL`, `HIGH`, `URGENT`.
- `support_business_hours` defaults to Africa/Lagos, Monday–Friday, 09:00–17:00.
- `lib/support.ts` `calculateSlaDue()` computes `first_response_due_at` and `resolution_due_at`.
- `getSlaState()` returns `ON_TRACK`, `DUE_SOON`, `BREACHED`.
- Business-hours logic is present; edge cases (holidays, 24/7) are not yet implemented.

## 12. Customer Success

Routes:
- `/admin/customer-success` — table by stage/health, open tickets, renewal, last contact, next action.
- `/admin/businesses/[businessId]/customer-success` — profile, health signals, activities, next action.

API: `/api/admin/customer-success` — `create_or_update`, `record_activity`, `update_health`, `get_signals`.

`lib/customer-success.ts` uses factual signals (open tickets, SLA breaches, deployment, subscription, outstanding invoice, renewal, last contact, training) rather than invented AI scores.

## 13. Customer Health

- Health managed by admin: `HEALTHY`, `WATCH`, `AT_RISK`, `CRITICAL`.
- `lib/customer-success.ts` `getHealthSignals()` surfaces data signals.
- `customer_success_profiles` tracks owner, stage, health, last contact, next follow-up.
- Activity records live in `customer_success_activities`.

## 14. Business 360 changes

Updated `app/admin/(protected)/businesses/[businessId]/business-detail.tsx`:
- Enabled `Finance`, `Support`, `Customer Success`, `Compliance` tabs.
- Tabs link to sub-pages: `/admin/businesses/[businessId]/support`, `/customer-success`, `/compliance`, and the existing `/finance`.
- Added sub-pages for support, customer success, and compliance under `/admin/businesses/[businessId]`.

## 15. Compliance

Routes:
- `/admin/compliance` — views: Awaiting Submission, Under Review, Verified, Rejected, Expiring, Expired.
- `/admin/businesses/[businessId]/compliance` — business-specific records.

API: `/api/admin/compliance` — `create_record`, `request_replacement`, `submit_document`, `review`, `set_expiry`.

`lib/compliance.ts` enforces request/review/verify/reject/expire states with audit logging.

## 16. Partner compliance changes

- Existing `partner:compliance:view` and `partner:compliance:submit` permissions used.
- Partner can see `compliance_records` filtered to their own partner.
- Partner can submit/replace documents but cannot self-verify or view internal notes.
- No new schema rebuild; `compliance_records` supports `subject_type = PARTNER`.

## 17. Partner complaints

- `PARTNER_COMPLAINT` category is a sensitive support category.
- `complained_about_partner_id` stored in `support_tickets.partner_id`.
- Server-side rule prevents the complained-about partner from seeing the ticket.

## 18. Incidents

- `customer_incidents` table created.
- `lib/support.ts` provides `CustomerIncident` types; creation/resolution helpers will be added in a future hardening pass.
- Security/data incidents remain MartPoint-only.

## 19. Action Centre

Route: `/admin/tasks`.
API: `/api/admin/tasks` — `GET` calls `generateAdminTasks()`, `POST` to mark status.

`lib/tasks.ts` aggregates live signals from:
- Partner applications, partner compliance, onboarding reviews, pending deployments, pending payments, approaching renewals, unassigned tickets, SLA breaches, customer follow-ups, expiring compliance.

**Known limitation**: `generateAdminTasks()` currently returns derived composite ids (`pa-...`, etc.) so `POST` mark-status does not persist to `admin_tasks`. The UI drops them locally. Full persistence requires a follow-up pass to upsert tasks with table UUIDs.

## 20. Notifications

`lib/notifications.ts` extended with:
- `SUPPORT_TICKET_CREATED`, `SUPPORT_TICKET_ASSIGNED`, `SUPPORT_PARTNER_ASSIGNED`, `SUPPORT_CUSTOMER_REPLY`, `SUPPORT_PARTNER_REPLY`, `SUPPORT_TICKET_ESCALATED`, `SUPPORT_TICKET_RESOLVED`.
- `CUSTOMER_SUCCESS_FOLLOW_UP_DUE`, `CUSTOMER_AT_RISK`, `RENEWAL_FOLLOW_UP`.
- `COMPLIANCE_DOCUMENT_REQUESTED`, `COMPLIANCE_DOCUMENT_SUBMITTED`, `COMPLIANCE_DOCUMENT_VERIFIED`, `COMPLIANCE_DOCUMENT_REJECTED`, `COMPLIANCE_DOCUMENT_EXPIRING`.

## 21. Permissions

`lib/support-permissions.ts` defines:
- Admin support actions: `support:view`, `support:create`, `support:assign`, `support:update`, `support:resolve`, `support:close`, `support:internal_notes`, `support:sensitive`, `support:sla_manage`.
- Customer success: `customer_success:view`, `customer_success:manage`.
- Compliance: `compliance:view`, `compliance:request`, `compliance:review`, `compliance:approve`.
- Partner: `support:view_assigned`, `support:manage_assigned`, `compliance:view`, `compliance:submit`.

`lib/admin-types.ts` `ROLE_PERMISSIONS` updated to include `support`, `customer_success`, `compliance`, `tasks`.

## 22. Audit logging

New `finance_audit_events` actions added:
- `SUPPORT_TICKET_CREATED`, `SUPPORT_TICKET_ASSIGNED`, `SUPPORT_TICKET_PARTNER_ASSIGNED`, `SUPPORT_TICKET_ESCALATED`, `SUPPORT_TICKET_PRIORITY_CHANGED`, `SUPPORT_TICKET_RESOLVED`, `SUPPORT_TICKET_REOPENED`, `SUPPORT_TICKET_CLOSED`, `SUPPORT_INTERNAL_NOTE_ADDED`.
- `CUSTOMER_SUCCESS_STAGE_CHANGED`, `CUSTOMER_HEALTH_CHANGED`, `CUSTOMER_SUCCESS_ACTIVITY_ADDED`.
- `COMPLIANCE_REQUESTED`, `COMPLIANCE_DOCUMENT_SUBMITTED`, `COMPLIANCE_VERIFIED`, `COMPLIANCE_REJECTED`, `COMPLIANCE_EXPIRED`.
- `CUSTOMER_INCIDENT_CREATED`, `CUSTOMER_INCIDENT_RESOLVED`.

`support_ticket_events` table also stores detailed per-ticket event history.

## 23. Security tests

Security assertions are designed and partially enforced:

1. Partner A cannot see Partner B tickets — enforced by `canPartnerViewTicket` (assignment + capability).
2. Partner cannot see unassigned customer tickets — enforced by `canPartnerAccessBusiness`.
3. Partner without `FIRST_LINE_SUPPORT` cannot access support — `partnerHasCapability`.
4. Partner without `support:view_assigned` cannot access customer support — `partnerUserHasPermission`.
5. Partner cannot see `INTERNAL` messages — UI/API filter `visibility = 'PUBLIC'`.
6. Partner cannot create `INTERNAL` messages — `addMessage` requires admin actor for `INTERNAL`.
7–11. Sensitive category access blocked server-side — `isSensitiveSupportCategory`.
12. Revoked assignment removes access — `canPartnerViewTicket` checks active assignment.
13–14. Suspended partner/user cannot access — `requirePartnerSession` validates `ACTIVE`.
15. Partner cannot change SLA — no SLA actions in partner API.
16. Partner cannot assign another partner — no assign action in partner API.
17. Partner escalation reaches MartPoint — `escalateTicket` sets `ESCALATED` and clears partner.
18. Admin sensitive permission enforced — `support:sensitive` checked.
19. Compliance document private — `support-attachments` private; document_path restricted.
20. Partner cannot self-verify — `reviewCompliance` is admin-only.
21. Partner cannot see internal compliance notes — `internal_notes` not exposed.
22. Customer A records cannot appear under Business B — foreign key scoping.
23. SLA deadlines use configured business hours — `calculateSlaDue` reads `support_business_hours`.
24. Audit events generated — service layer calls `logSupportAudit` etc.
25. Regression — `npm run build` and `npx tsc --noEmit` pass.

**Automated test suite**: permission unit tests are written and passing. Full DB-backed security tests are documented for a future hardening pass.

## 24. Regression tests

- `npx tsc --noEmit` passes.
- `npm run build` passes.
- `npm run test:finance` passes (8 tests).
- Existing Sprint 1–4 routes and functionality unchanged.

## 25. Known limitations

- **Action centre persistence**: derived `admin_tasks` do not yet upsert to `admin_tasks`, so `POST` status updates are local-only.
- **Customer incident UI/API**: backend table exists; dedicated admin pages not built.
- **Support email ingestion**: only outbound notification architecture in place; inbound parsing not built (per spec).
- **WhatsApp inbox**: ticket `source = WHATSAPP` supported; full WhatsApp integration not built (per spec).
- **Attachment signed URLs**: storage bucket created; signed-URL helper not yet wired into UI.
- **Full DB-backed security tests**: not yet executed (require test database).
- **Finance technical debt from Sprint 4**: remains documented separately for Sprint 6.

## 26. Environment/configuration changes

No new environment variables. Existing variables used:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`.

When inbound email or WhatsApp is added, gateway credentials will be added separately.

## 27. Production migration instructions

1. Apply `supabase/migrations/013_sprint5_support_customer_success_compliance.sql` to the production Supabase project.
2. Verify default SLA and business hours match operating policy.
3. Re-deploy the Next.js application.
4. Grant appropriate admin users support/customer-success/compliance page permissions (`lib/admin-types.ts`).

## 28. Screenshots/route evidence

Build output confirms new routes:

- `ƒ /admin/support`
- `ƒ /admin/support/[ticketId]`
- `ƒ /admin/customer-success`
- `ƒ /admin/compliance`
- `ƒ /admin/tasks`
- `ƒ /admin/businesses/[businessId]/support`
- `ƒ /admin/businesses/[businessId]/customer-success`
- `ƒ /admin/businesses/[businessId]/compliance`
- `ƒ /api/admin/support/[resource]`
- `ƒ /api/admin/customer-success`
- `ƒ /api/admin/compliance`
- `ƒ /api/admin/tasks`
- `ƒ /partner/support`
- `ƒ /partner/support/[ticketId]`
- `ƒ /api/partner/support`

---

**End of Sprint 5 implementation report.**
