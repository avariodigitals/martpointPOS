# MartPoint Test Environment

## Recommended Setup

Use a dedicated Supabase project for all DB-backed integration tests. Do not run destructive tests against the production project.

## Steps

1. Create a Supabase test project (e.g. `martpoint-test`).
2. Copy production migration files to the test project.
3. Apply migrations `001_init.sql` through `016_sprint6_closure.sql`.
4. Run `npx supabase db reset` or `npx supabase start` if using local CLI.
5. Seed deterministic records:
   - Admin user(s)
   - Partner organisations of different types
   - Partner users with/without permissions
   - Businesses, leads, invoices, payments, support tickets, compliance records, commissions
6. Run the test suite `npx vitest run --config vitest.config.ts`.
7. Truncate or reset the database between runs.

## Environment

Create `.env.test`:

```
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Never commit `.env.test`.

## Current Status

No local Supabase CLI or Docker is available in this environment. The test database and DB-backed test execution are a manual production-readiness action.
