# MartPoint Production Readiness Checklist

| Area | Status | Notes |
|------|--------|-------|
| Migrations | READY | Migrations 001–016 present. Apply 016 before production. |
| Environment variables | MANUAL | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, auth secrets. |
| Secrets | MANUAL | Store in Devin Cloud or CI secret manager; never commit. |
| Authentication | READY | Admin and partner session cookies implemented. |
| Admin permissions | READY | `lib/admin-types.ts` maps role permissions. |
| Partner permissions | READY | `lib/partner-permissions.ts` enforces capability/role/assignment. |
| Storage buckets | READY | `support-attachments`, `partner-documents` are private. |
| RLS / database security | MANUAL | Review final migration and run `scripts/partner-security-check.ts` against test DB. |
| Rate limiting | READY | `lib/rate-limit.ts` in place. |
| Email | READY | Resend abstraction via `lib/email.ts` if key configured. |
| Finance | READY | Kobo arithmetic, invoice/payment/subscription/commission implemented. |
| Executive dashboard | READY | `/admin` now shows Control Centre metrics. |
| Reporting | READY | `/admin/reports` functional with tabbed reports. |
| Partner 360 / performance | READY | `/admin/partners/[partnerId]` and `/admin/partners/performance` built. |
| Global search | READY | `/admin/search` cross-entity search with permission check. |
| Notification centre | READY | `/admin/notifications` with persisted read state. |
| Audit viewer | READY | `/admin/audit` with filters and redaction. |
| Printable receipt | MANUAL | `/receipts/[receiptNumber]` implemented. Existing payments need `receipt_number` populated. |
| Payment gateways | MANUAL | Adapters and webhook routes ready. Require live credentials. |
| Commission attribution | READY | `lib/commission-attribution.ts` and extended commission schema. |
| Backups | MANUAL | Configure Supabase backups and point-in-time recovery. |
| Monitoring | MANUAL | `lib/logger.ts` structured logging in place; external provider optional. |
| Test database | MANUAL | Dedicated Supabase project needed for DB-backed tests. |
| Integration tests | MANUAL | Partner/support/finance security tests require test DB. |
| Regression tests | READY | `npx tsc --noEmit`, `npm run build`, `npx vitest run` pass. |
| Deployment | MANUAL | Configure production Vercel/Node environment. |
| Rollback | MANUAL | Keep previous deployment and migration snapshots. |

## Blockers for Uncontrolled Production

1. Payment gateway credentials and webhook verification.
2. Dedicated test database for DB-backed security tests (actual results required).
3. End-to-end partner and direct-customer journey execution with real data.
4. Backup/recovery verification.
5. External error-monitoring provider (if desired beyond `lib/logger.ts`).

## Recommendation

Core Control Centre features are implemented. The system is **READY FOR CONTROLLED PRODUCTION** with MartPoint operations staff once the manual items above are completed and DB-backed tests are executed in a dedicated test project. It is **NOT READY for unattended production** until payment gateway, test database, and monitoring/backup are verified.
