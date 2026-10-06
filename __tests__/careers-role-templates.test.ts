import { describe, it, expect } from "vitest"
import { hasPermission, authorize } from "@/lib/admin-types"
import { formatCompensation } from "@/lib/careers"
import {
  templateToVacancyPrefill,
  ROLE_CATEGORIES,
  type CareerRoleTemplate,
} from "@/lib/careers-role-templates"
import {
  computeCommission,
  isEligibleRevenueCategory,
  COMMISSION_EXCLUDED_CATEGORIES,
  type CommissionRules,
} from "@/lib/careers-commissions"

function template(overrides: Partial<CareerRoleTemplate> = {}): CareerRoleTemplate {
  return {
    id: "t1",
    name: "Temporary Inventory Officer",
    role_category: "FLEXIBLE",
    department_id: "d1",
    job_category_id: "c1",
    purpose: "Capture product data on-site.",
    employment_type: "PROJECT_BASED",
    work_arrangement: "ON_SITE",
    default_location: { country: "Nigeria", state: "Osun", lga: "Ifelodun", city: "Ilobu", public_description: "Ilobu" },
    openings: 5,
    responsibilities: ["Capture products", "Meet daily target"],
    requirements: ["Owns Android smartphone"],
    performance_indicators: ["Verified products per day"],
    reporting_line: "Inventory Team Lead",
    working_days: "Monday – Friday",
    work_start_time: "08:00",
    work_end_time: "17:00",
    probation_period: null,
    base_compensation_kobo: 1000000,
    compensation_type: "DAILY_PLUS_TRANSPORT",
    currency: "NGN",
    transport_allowance_kobo: 200000,
    feeding_arrangement: "Lunch and water provided on site.",
    data_call_allowance_kobo: null,
    commission_eligible: false,
    commission_rules: {},
    performance_bonus: null,
    show_compensation_public: true,
    required_equipment: { owns_android: true, has_mobile_data: true, items: ["Power bank"] },
    screening_questions: [
      { question_text: "Do you own an Android smartphone?", answer_type: "YES_NO", required: true, knockout: true, options: [] },
    ],
    assessment_type: "PRODUCT_CAPTURE",
    interview_scorecard: [],
    consent_text: null,
    status: "INACTIVE",
    version: 1,
    created_by: null,
    updated_by: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

describe("role template → vacancy prefill", () => {
  it("maps the template into editable vacancy fields", () => {
    const p = templateToVacancyPrefill(template())
    expect(p.role_template_id).toBe("t1")
    expect(p.title).toBe("Temporary Inventory Officer")
    expect(p.openings).toBe(5)
    expect(p.employment_type).toBe("PROJECT_BASED")
    expect(p.compensation_type).toBe("DAILY_PLUS_TRANSPORT")
    expect(p.compensation_min_kobo).toBe(1000000)
    expect(p.transport_allowance_kobo).toBe(200000)
    expect(p.show_compensation).toBe(true)
    expect(p.lunch_provided).toBe(true)
    expect(p.locations[0].city).toBe("Ilobu")
    expect(p.questions[0].question_text).toContain("Android")
    expect(p.questions[0].knockout).toBe(true)
    expect(p.assessment_type).toBe("PRODUCT_CAPTURE")
    expect(p.performance_indicators).toContain("Verified products per day")
  })

  it("defaults show_compensation to the template's public flag", () => {
    const p = templateToVacancyPrefill(template({ show_compensation_public: false }))
    expect(p.show_compensation).toBe(false)
  })

  it("produces no locations when the template has no default", () => {
    const p = templateToVacancyPrefill(template({ default_location: {} }))
    expect(p.locations).toEqual([])
  })
})

describe("commission rules", () => {
  const rules: CommissionRules = {
    basis: "PERCENTAGE",
    self_lead_rate: 10,
    company_lead_rate: 4,
    minimum_payout_kobo: 500000,
    clawback_on_refund: true,
  }

  it("rejects built-in excluded categories", () => {
    for (const c of COMMISSION_EXCLUDED_CATEGORIES) {
      expect(isEligibleRevenueCategory(c, {}).eligible).toBe(false)
    }
    expect(computeCommission(rules, { category: "Hardware", amountKobo: 10000000, leadSource: "SELF_GENERATED" }).eligible).toBe(false)
  })

  it("applies the self-generated rate over the company rate", () => {
    const r = computeCommission(rules, { category: "Subscription", amountKobo: 10000000, leadSource: "SELF_GENERATED" })
    expect(r.eligible).toBe(true)
    expect(r.rate).toBe(10)
    expect(r.amountKobo).toBe(1000000)
  })

  it("applies the company rate for company-generated leads", () => {
    const r = computeCommission(rules, { category: "Subscription", amountKobo: 10000000, leadSource: "COMPANY_GENERATED" })
    expect(r.rate).toBe(4)
    expect(r.amountKobo).toBe(400000)
  })

  it("falls back to the base percentage when no lead-source rate is set", () => {
    const r = computeCommission(
      { basis: "PERCENTAGE", percentage: 5 },
      { category: "Subscription", amountKobo: 1000000, leadSource: "SELF_GENERATED" }
    )
    expect(r.amountKobo).toBe(50000)
  })

  it("supports fixed-amount commission", () => {
    const r = computeCommission(
      { basis: "FIXED", fixed_amount_kobo: 250000 },
      { category: "Subscription", amountKobo: 99999999, leadSource: "COMPANY_GENERATED" }
    )
    expect(r.amountKobo).toBe(250000)
    expect(r.rate).toBeNull()
  })

  it("marks sub-threshold commission as earned but not payable", () => {
    const r = computeCommission(rules, { category: "Subscription", amountKobo: 1000000, leadSource: "COMPANY_GENERATED" })
    expect(r.amountKobo).toBe(40000)
    expect(r.payable).toBe(false)
    expect(r.reason).toMatch(/threshold/i)
  })

  it("reverses commission on refunded payments", () => {
    const r = computeCommission(rules, { category: "Subscription", amountKobo: 10000000, leadSource: "SELF_GENERATED", refunded: true })
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/refund/i)
  })

  it("management can re-include an excluded category", () => {
    const r = computeCommission(
      { ...rules, include_overrides: ["hardware"] },
      { category: "Hardware", amountKobo: 10000000, leadSource: "SELF_GENERATED" }
    )
    expect(r.eligible).toBe(true)
    expect(r.amountKobo).toBe(1000000)
  })

  it("respects an explicit eligible list", () => {
    const strict: CommissionRules = { basis: "PERCENTAGE", percentage: 5, eligible_categories: ["Subscription"] }
    expect(computeCommission(strict, { category: "Subscription", amountKobo: 100, leadSource: "SELF_GENERATED" }).eligible).toBe(true)
    expect(computeCommission(strict, { category: "Training", amountKobo: 100, leadSource: "SELF_GENERATED" }).eligible).toBe(false)
  })
})

describe("new compensation types", () => {
  it("labels the new compensation structures", () => {
    expect(
      formatCompensation({ compensation_type: "SALARY_PLUS_COMMISSION", compensation_min_kobo: 15000000, compensation_max_kobo: null, currency: "NGN", show_compensation: true })
    ).toBe("₦150,000 per month + commission")
    expect(
      formatCompensation({ compensation_type: "DAILY_PLUS_TRANSPORT", compensation_min_kobo: 1000000, compensation_max_kobo: null, currency: "NGN", show_compensation: true })
    ).toBe("₦10,000 per day + transport")
    expect(
      formatCompensation({ compensation_type: "RETAINER", compensation_min_kobo: 5000000, compensation_max_kobo: null, currency: "NGN", show_compensation: true })
    ).toBe("₦50,000 retainer")
  })
})

describe("new careers permissions", () => {
  const newPerms = [
    "careers.role_templates.view",
    "careers.role_templates.create",
    "careers.role_templates.edit",
    "careers.role_templates.archive",
    "careers.compensation.view",
    "careers.compensation.manage",
    "careers.commissions.view",
    "careers.commissions.approve",
    "careers.commissions.pay",
    "careers.performance.view",
    "careers.performance.manage",
  ]

  it("Admin is authorized for every new permission", () => {
    const admin = { userId: "u1", username: "admin", role: "Admin" as const, name: "A", iat: Date.now(), lastActive: Date.now() }
    for (const p of newPerms) expect(authorize(admin, p)).toBe(true)
  })

  it("HR Manager manages templates and approves commissions but cannot pay", () => {
    for (const p of newPerms.filter((p) => p !== "careers.commissions.pay")) {
      expect(hasPermission("HR Manager", p)).toBe(true)
    }
    expect(hasPermission("HR Manager", "careers.commissions.pay")).toBe(false)
  })

  it("Finance can view compensation, approve and pay commissions, and view performance", () => {
    expect(hasPermission("Finance", "careers.compensation.view")).toBe(true)
    expect(hasPermission("Finance", "careers.commissions.pay")).toBe(true)
    expect(hasPermission("Finance", "careers.performance.view")).toBe(true)
    expect(hasPermission("Finance", "careers.compensation.manage")).toBe(false)
    expect(hasPermission("Finance", "careers.role_templates.view")).toBe(false)
  })

  it("reviewer and deployment supervisor have no access to new surfaces", () => {
    for (const p of newPerms) {
      expect(hasPermission("Reviewer", p)).toBe(false)
      expect(hasPermission("Deployment Supervisor", p)).toBe(false)
    }
  })
})

describe("role categories", () => {
  it("covers the three workforce groups", () => {
    expect(ROLE_CATEGORIES).toEqual(["CORE", "FLEXIBLE", "RETAINER"])
  })
})
