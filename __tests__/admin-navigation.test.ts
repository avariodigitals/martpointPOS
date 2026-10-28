import { describe, it, expect } from "vitest"
import {
  adminNavItems,
  ADMIN_SECTION_ORDER,
  getAdminNavigation,
  activeAdminHref
} from "@/lib/admin-navigation"
import { ALL_ROLES, hasPermission } from "@/lib/admin-types"
import inventory from "./fixtures/admin-navigation-inventory.json"

describe("process-oriented admin navigation", () => {
  it("preserves every existing destination and its exact permission requirement", () => {
    expect(
      adminNavItems.map(({ href, page }) => ({ href, page })).sort((a, b) => a.href.localeCompare(b.href))
    ).toEqual([...inventory].sort((a, b) => a.href.localeCompare(b.href)))
    expect(new Set(adminNavItems.map((item) => item.href)).size).toBe(inventory.length)
  })
  it("follows the approved acquisition, conversion and service flow", () => {
    expect(ADMIN_SECTION_ORDER).toEqual([
      "Control Centre",
      "Marketing & Content",
      "Creator Network",
      "Partner Network",
      "Sales",
      "Finance",
      "Onboarding & Customers",
      "Support & Communications",
      "Operations",
      "People & Careers",
      "Administration"
    ])
    expect(getAdminNavigation("Admin").sections.map((section) => section.label)).toEqual(ADMIN_SECTION_ORDER)
  })
  it.each(ALL_ROLES)("keeps %s permissions unchanged and omits empty sections", (role) => {
    const nav = getAdminNavigation(role)
    expect(nav.visibleItems.map((item) => item.href).sort()).toEqual(
      inventory
        .filter((item) => hasPermission(role, item.page))
        .map((item) => item.href)
        .sort()
    )
    expect(nav.sections.every((section) => section.items.length > 0)).toBe(true)
    expect(nav.sections.flatMap((section) => section.items).map((item) => item.href)).toEqual(
      nav.visibleItems.map((item) => item.href)
    )
  })
  it("keeps daily shortcuts visible and moves configuration out of operational menus", () => {
    const sections = getAdminNavigation("Admin").sections
    expect(sections[0].collapsible).toBe(false)
    expect(sections[0].items.map((item) => item.href)).toEqual(["/admin", "/admin/tasks", "/admin/reports"])
    const admin = sections
      .find((section) => section.label === "Administration")!
      .items.map((item) => item.href)
    for (const href of [
      "/admin/audit",
      "/admin/azera/settings",
      "/admin/azera/voice-agents",
      "/admin/creators/settings",
      "/admin/careers/settings"
    ])
      expect(admin).toContain(href)
    expect(sections.find((section) => section.label === "Support & Communications")!.items[0].href).toBe(
      "/admin/support"
    )
  })
  it("orders conversion steps and partner/creator workflows rather than alphabetical modules", () => {
    const sections = getAdminNavigation("Admin").sections
    expect(sections.find((section) => section.label === "Sales")!.items.map((item) => item.href)).toEqual([
      "/admin/leads",
      "/admin/calendar",
      "/admin/quotations?estimator=1",
      "/admin/quotations"
    ])
    expect(
      sections
        .find((section) => section.label === "Partner Network")!
        .items.slice(0, 3)
        .map((item) => item.href)
    ).toEqual(["/admin/partners/prospects", "/admin/partners/applications", "/admin/partners/assessments"])
  })
})

describe("active navigation destination", () => {
  const items = getAdminNavigation("Admin").visibleItems
  const active = (path: string, query = "") => activeAdminHref(items, path, new URLSearchParams(query))
  it("selects only the estimator, not quotations, when their shared path has its distinguishing query", () => {
    expect(active("/admin/quotations", "estimator=1")).toBe("/admin/quotations?estimator=1")
    expect(active("/admin/quotations")).toBe("/admin/quotations")
  })
  it("keeps creator support separate from the general support workspace", () => {
    expect(active("/admin/support", "category=CREATOR_NETWORK&ticket=123")).toBe(
      "/admin/support?category=CREATOR_NETWORK"
    )
    expect(active("/admin/support", "ticket=123")).toBe("/admin/support")
  })
  it("opens the right parent on detail pages without marking every ancestor active", () => {
    expect(active("/admin/creators/applications/123")).toBe("/admin/creators/applications")
    expect(active("/admin/partners/quotes/123")).toBe("/admin/partners/quotes")
    expect(active("/admin/businesses/123/support")).toBe("/admin/businesses")
    expect(active("/admin/azera/settings")).toBe("/admin/azera/settings")
  })
  it("handles finance query siblings and ignores non-matching route prefixes", () => {
    expect(active("/admin/finance/transactions", "type=expense")).toBe(
      "/admin/finance/transactions?type=expense"
    )
    expect(active("/admin/finance/transactions", "type=income")).toBe(
      "/admin/finance/transactions?type=income"
    )
    expect(active("/admin/partners-extra")).toBeUndefined()
    expect(active("/admin")).toBe("/admin")
  })
  it("does not select a destination hidden from the current role", () => {
    const restricted = getAdminNavigation("Sales").visibleItems
    expect(activeAdminHref(restricted, "/admin/audit", new URLSearchParams())).toBeUndefined()
  })
})
