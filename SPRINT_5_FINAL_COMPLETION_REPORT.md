# MARTPOINT SPRINT 5 — FINAL COMPLETION REPORT

## 1. Action Centre persistence implementation

`lib/tasks.ts` was rewritten to persist generated work in `admin_tasks`:

- Deterministic source identity via `source_type`, `source_id`, `task_type`.
- Unique partial index on `(source_type, source_id, task_type)`.
- `syncAdminTasks()` upserts active tasks and marks stale open/in-progress tasks as `DONE` automatically.
- `updateAdminTask()` persists `status`, `assigned_to`, `completed_at`.
- `resolveAdminTasks()` lets service actions close generated tasks immediately.
- `lib/support.ts` now resolves `SUPPORT_UNASSIGNED` on admin assignment/partner assignment and `SLA_BREACH` on ticket resolution.
- Migration: `supabase/migrations/014_sprint5_completion_pass.sql` adds `source_type`, `source_id`, `priority`, `completed_at` to `admin_tasks`.

## 2. Task synchronisation rules

- Generated tasks never duplicate because of the unique constraint.
- `DONE` and `DISMISSED` user states are not overwritten by the sync.
- Stale tasks (no longer matching a live condition) are auto-closed.
- Tasks persist across refresh, logout, and different admin users because they live in `admin_tasks`.
- `GET /api/admin/tasks` syncs by default; `?sync=false` returns the current persisted list.

## 3. Incident implementation

- `lib/customer-incidents.ts` created with `createIncident`, `updateIncident`, `resolveIncident`, `closeIncident`, `listIncidents`, `getIncidentById`.
- Routes:
  - `/admin/incidents` and `/admin/incidents/[incidentId]`.
  - `/admin/businesses/[businessId]/incidents`.
- API: `/api/admin/incidents/[resource]` with `create`, `update`, `link_ticket`, `resolve`, `close`.
- Audit events: `CUSTOMER_INCIDENT_CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `SEVERITY_CHANGED`, `RESOLVED`, `CLOSED`.

## 4. Incident security

- All actions require `support:view`, `support:create`, `support:update`, `support:resolve`, `support:close`, `support:sensitive`.
- `SECURITY` and `DATA` incident creation and `RESOLVED`/`CLOSED` transitions require `support:sensitive`.
- Incident data is not exposed in partner APIs.
- Partner has no incident access unless a future safe workflow is built.

## 5. Signed attachment implementation

- `lib/support-attachments.ts` created:
  - `uploadSupportAttachment()` validates file size (≤5MB), MIME type and extension, uploads to private `support-attachments` bucket, and records metadata in `support_attachments`.
  - `getSignedAttachmentUrl()` verifies the actor can access the ticket and the attachment is not internal/sensitive before returning a short-lived signed URL.
- `app/api/admin/support/attachments/route.ts`: admin upload and signed-URL endpoints.
- `app/api/partner/support/attachments/route.ts`: partner upload and signed-URL endpoints, enforcing `canPartnerViewTicket`.
- Migration: `support_attachments` table created in `014_sprint5_completion_pass.sql`.

## 6. Partner complaint model

- Migration `014` adds `support_tickets.complained_about_partner_id`.
- `lib/support.ts` types, `createTicket`, `assignPartner`, `canPartnerViewTicket`, `isTicketVisibleToPartner` all treat `complained_about_partner_id` separately from `assigned_partner_id`.
- A partner cannot be assigned to a ticket where they are the complained-about party.
- A complained-about partner can never view the complaint ticket, even if `assigned_partner_id` were set.

## 7. SLA first-response implementation

- `addMessage()` in `lib/support.ts` sets `first_responded_at` only for `PUBLIC` messages from `ADMIN` or `PARTNER`.
- `SYSTEM` events and `INTERNAL` notes do not count as first response.
- `addBusinessMinutes()` exported and tested for:
  - within working hours
  - after 5 PM
  - Friday after hours → Monday
  - weekend → Monday
  - crossing close → next day.
- `calculateSlaDue()` continues to use configured `support_business_hours`.

## 8. Security tests

Automated unit tests added in `__tests__/support-completion.test.ts`:

- Partner cannot view sensitive ticket (`BILLING`, `SECURITY`, etc.).
- Partner cannot view ticket of another partner.
- Complained-about partner cannot view the complaint.
- `addBusinessMinutes` correctly handles working hours, after-hours, weekends, Friday→Monday.

Additional tests from `__tests__/support-permissions.test.ts`:

- Sensitive category detection.
- Partner cannot access sensitive support categories.
- Admin role permissions.

DB-backed integration tests for attachment signed URLs, revoked assignment, and organisation suspension require a separate test database and were not executed against production.

## 9. Regression tests

- `npx tsc --noEmit` — **pass**
- `npm run build` — **pass**
- `npx vitest run --config vitest.config.ts` — **pass (17 tests)**

Existing Sprint 1–5 routes continue to compile and build:

- `/admin/partners`, `/admin/leads`, `/admin/onboarding`, `/admin/businesses`, `/admin/finance/*`, `/admin/support`, `/admin/customer-success`, `/admin/compliance`, `/admin/tasks`, `/admin/incidents`, `/partner/*`, `/api/partner/*`, `/api/admin/*`.

## 10. Build result

```
npm run build
✓ Compiled successfully in 13.2s
✓ TypeScript ...
✓ Generating static pages (163/163)
Exit code: 0
```

## 11. TypeScript result

```
npx tsc --noEmit
# Exit code: 0
```

## 12. Remaining limitations

- Full DB-backed security tests (attachment isolation, revoked assignment, suspended partner, etc.) require a safe test database and were not run.
- Inbound support email parsing not built.
- WhatsApp shared inbox not built.
- AI support not built.
- Customer portal not built.
- No new finance or partner functionality (per scope).
- Sprint 6 not begun.

## 13. Migration files

- `supabase/migrations/013_sprint5_support_customer_success_compliance.sql` — initial Sprint 5 schema.
- `supabase/migrations/014_sprint5_completion_pass.sql` — completion pass: `admin_tasks` persistence, `support_tickets.complained_about_partner_id`, `support_attachments` metadata.

## 14. Production deployment instructions

1. Apply migration `014_sprint5_completion_pass.sql` to production Supabase.
2. Re-deploy the Next.js application.
3. Verify admin page permissions in `lib/admin-types.ts` include `tasks`, `support`, `customer_success`, `compliance`.
4. Confirm `support-attachments` storage bucket remains private and signed URLs are short-lived.
5. Do not begin Sprint 6.

---

**End of Sprint 5 final completion report.**
