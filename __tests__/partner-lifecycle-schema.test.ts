import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("partner lifecycle data and access safeguards", () => {
  const migration = read("supabase/migrations/193_partner_lifecycle_automation.sql")
  const lifecycleService = read("lib/partner-lifecycle.ts")
  const publicPartners = read("lib/partners.ts")

  it("keeps legacy clocks unset and new registrations hidden", () => {
    expect(migration).toContain("transition_start_at)");
    expect(migration).toContain("VALUES(NEW.id, CASE WHEN NEW.status='ACTIVE' THEN 'enabled' ELSE 'pending' END, 'incomplete', 'hidden')")
    expect(migration).toMatch(/INSERT INTO partner_lifecycle\(partner_id, account_status, onboarding_status, listing_status, transition_start_at\)[\s\S]*?NULL\nFROM partners/)
  })

  it("protects public directory data with both RLS and lifecycle filters", () => {
    expect(migration).toContain("REVOKE ALL ON partner_lifecycle FROM anon, authenticated")
    expect(migration).toContain("EXISTS (\n    SELECT 1 FROM partner_lifecycle")
    expect(publicPartners).toContain("partner_lifecycle.listing_status")
    expect(publicPartners).toContain("partner_lifecycle.compliance_status")
  })

  it("keeps account standing and commission records outside directory automation", () => {
    expect(lifecycleService).toContain("public_profile_enabled: visible")
    expect(lifecycleService).not.toContain("from(\"partners\").update({ status:")
    expect(lifecycleService).not.toContain("from(\"partner_commissions\")")
  })

  it("makes notice and automated review idempotency keys database unique", () => {
    expect(migration).toContain("idempotency_key TEXT NOT NULL UNIQUE")
    expect(migration).toContain("idempotency_key TEXT UNIQUE")
  })
})
