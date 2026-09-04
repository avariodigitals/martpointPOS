import { describe, it, expect } from "vitest"
import {
  hasSupportAdminAction,
  isSensitiveSupportCategory,
  canPartnerAccessSupportCategory,
} from "@/lib/support-permissions"

describe("support permissions", () => {
  it("grants Admin all support actions", () => {
    expect(hasSupportAdminAction("Admin", "support:sensitive")).toBe(true)
    expect(hasSupportAdminAction("Admin", "compliance:approve")).toBe(true)
  })

  it("denies non-support roles sensitive access", () => {
    expect(hasSupportAdminAction("Sales", "support:sensitive")).toBe(false)
    expect(hasSupportAdminAction("Editor", "support:create")).toBe(false)
  })

  it("marks billing, licensing, security, privacy and partner complaint as sensitive", () => {
    expect(isSensitiveSupportCategory("BILLING")).toBe(true)
    expect(isSensitiveSupportCategory("SECURITY")).toBe(true)
    expect(isSensitiveSupportCategory("PRIVACY_DATA")).toBe(true)
    expect(isSensitiveSupportCategory("PARTNER_COMPLAINT")).toBe(true)
    expect(isSensitiveSupportCategory("SOFTWARE")).toBe(false)
  })

  it("partners cannot access any sensitive category", () => {
    expect(canPartnerAccessSupportCategory("BILLING")).toBe(false)
    expect(canPartnerAccessSupportCategory("POS")).toBe(true)
  })
})
