# MartPoint Production Readiness Checklist

| Area | Status | Notes |
|------|--------|-------|
| Migrations | READY | Migrations 001–015 present. Apply 015 before production. |
| Environment variables | MANUAL | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`, auth secrets. |
| Secrets | MANUAL | Store in Devin Cloud or CI secret manager; never commit. |
| Authentication | READY | Admin and partner session cookies implemented. |
| Admin permissions | READY | `lib/admin-types.ts` maps role permissions. |
| Partner permissions | READY | `lib/partner-permissions.ts` enforces capability/role/assignment. |
| Storage buckets | READY | `support-attachments`, `partner-documents` are private. |
| RLS / database security | MANUAL | Review final migration and run `scripts/partner-security-check.ts`. |
| Rate limiting | READY | `lib/rate-limit.ts` in place. |
| Email | READY | Resend abstraction via `lib/email.ts` if key configured. |
| Finance | READY | Kobo arithmetic, invoice/payment/subscription/commission implemented. |
| Payment gateways | MANUAL | Paystack/Flutterwave adapters stubbed; require live credentials and webhooks. |
| Printable receipt | MANUAL | Route and view must be added per production design. |
| Backups | MANUAL | Configure Supabase backups and point-in-time recovery. |
| Monitoring | MANUAL | Add error-observability provider or structured logging pipeline. |
| Test database | MANUAL | Set up a dedicated Supabase project for DB-backed tests. |
| Integration tests | MANUAL | Partner/support/finance security tests require test DB. |
| Regression tests | READY | `npx tsc --noEmit`, `npm run build`, `npx vitest run` pass. |
| Deployment | MANUAL | Configure production Vercel/Node environment. |
| Rollback | MANUAL | Keep previous deployment and migration snapshots. |

## Blockers for Uncontrolled Production

1. Payment gateway credentials and webhook verification.
2. Dedicated test database for DB-backed security tests.
3. End-to-end partner and direct-customer journey execution with real data.
4. Error-monitoring provider.
5. Backup/recovery verification.

## Recommendation

Ready for **controlled pilot** with manual production actions above. Not ready for fully unattended production until payment gateway, test database, and monitoring are in place.
