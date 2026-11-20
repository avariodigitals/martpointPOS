import { describe, expect, it } from "vitest"
import {
  calculateGrowthScore,
  canOfferGrowthAward,
  DEFAULT_GROWTH_QUESTIONS,
  growthAssessmentSchema,
  growthEligibilityFlags,
  growthQuestionnaireSchema,
  redactContactDetails,
  validateGrowthAnswers,
  type GrowthQuestion,
} from "@/lib/business-growth-policy"

const questions: GrowthQuestion[] = [
  { id: "business", label: "Business", type: "text", required: true, maxLength: 20 },
  { id: "fit", label: "Basic fit", type: "select", required: true, options: ["Yes", "No"] },
  { id: "optional", label: "Optional", type: "textarea", required: false, maxLength: 30 },
]

describe("Business Growth Programme application policy", () => {
  it("requires all required answers and trims submitted text", () => {
    expect(validateGrowthAnswers(questions, { business: "  Shop  ", fit: "Yes" })).toEqual({
      ok: true,
      answers: { business: "Shop", fit: "Yes" },
    })
    expect(validateGrowthAnswers(questions, { business: " ", fit: "Yes" })).toMatchObject({ ok: false })
    expect(validateGrowthAnswers(questions, { business: "Shop" })).toMatchObject({ ok: false })
  })

  it("rejects invalid select values and answers beyond the configured limit", () => {
    expect(validateGrowthAnswers(questions, { business: "Shop", fit: "Maybe" })).toMatchObject({ ok: false })
    expect(validateGrowthAnswers(questions, { business: "x".repeat(21), fit: "Yes" })).toMatchObject({ ok: false })
  })

  it("enforces a bounded questionnaire with unique IDs and valid select options", () => {
    expect(growthQuestionnaireSchema.safeParse(DEFAULT_GROWTH_QUESTIONS).success).toBe(true)
    const valid = Array.from({ length: 5 }, (_, index) => ({ id: `question_${index}`, label: `Question number ${index}`, type: "text", required: true }))
    expect(growthQuestionnaireSchema.safeParse(valid).success).toBe(true)
    expect(growthQuestionnaireSchema.safeParse([...valid, { ...valid[0], id: "different" }]).success).toBe(true)
    expect(growthQuestionnaireSchema.safeParse([...valid.slice(0, 4), valid[0]]).success).toBe(false)
    expect(growthQuestionnaireSchema.safeParse([...valid.slice(0, 4), { id: "selection", label: "Choose an answer", type: "select", required: true }]).success).toBe(false)
    expect(growthQuestionnaireSchema.safeParse([...valid, ...valid, ...valid, ...valid, ...valid, ...valid, ...valid, ...valid, ...valid]).success).toBe(false)
  })

  it("does not require or retain absent optional answers", () => {
    expect(validateGrowthAnswers(questions, { business: "Shop", fit: "Yes" })).toEqual({
      ok: true,
      answers: { business: "Shop", fit: "Yes" },
    })
  })

  it("calculates the score from fixed rubric criteria, whose maximum is 100", () => {
    expect(calculateGrowthScore({ product_fit: 30, challenge_fit: 25, readiness: 25, ongoing_value: 15, feedback: 5 })).toBe(100)
    expect(calculateGrowthScore({ product_fit: 20, challenge_fit: 10, readiness: 12, ongoing_value: 8, feedback: 3 })).toBe(53)
  })

  it("enforces every rubric maximum and rejects model-provided total scores", () => {
    const assessment = {
      recommendation: "REVIEW",
      criteria: { product_fit: 30, challenge_fit: 25, readiness: 25, ongoing_value: 15, feedback: 5 },
      summary: "Evidence is mixed.",
      supported_needs: [],
      unsupported_or_uncertain_needs: [],
      evidence: [],
      missing_information: [],
      clarification_questions: [],
    }
    expect(growthAssessmentSchema.safeParse(assessment).success).toBe(true)
    expect(growthAssessmentSchema.safeParse({ ...assessment, criteria: { ...assessment.criteria, product_fit: 31 } }).success).toBe(false)
    expect(growthAssessmentSchema.safeParse({ ...assessment, criteria: { ...assessment.criteria, challenge_fit: -1 } }).success).toBe(false)
    expect(growthAssessmentSchema.safeParse({ ...assessment, total_score: 1000 }).success).toBe(false)
  })

  it("surfaces explicit readiness and package-fit flags without auto-rejecting", () => {
    expect(growthEligibilityFlags({
      operating_since: "Not yet operating",
      basic_fit: "No",
      operator: "We have not decided",
      records_readiness: "Cannot prepare yet",
      reviews_commitment: "No",
    })).toEqual([
      "BUSINESS_NOT_YET_OPERATING_REVIEW",
      "BASIC_PACKAGE_NOT_ACCEPTED_REVIEW",
      "OPERATOR_UNCONFIRMED",
      "ONBOARDING_RECORDS_NOT_READY",
      "PROGRAMME_REVIEW_COMMITMENT_UNCONFIRMED",
    ])
    expect(growthEligibilityFlags({ basic_fit: "Unsure" })).toContain("BASIC_PACKAGE_CLARIFICATION")
    expect(growthEligibilityFlags({ operating_since: "Over 3 years", basic_fit: "Yes", operator: "Ada", records_readiness: "Ready now", reviews_commitment: "Yes" })).toEqual([])
  })

  it("permits offers only after closure, shortlist and a completed assessment", () => {
    expect(canOfferGrowthAward("REVIEWING", "SHORTLISTED", "COMPLETED")).toBe(true)
    expect(canOfferGrowthAward("OPEN", "SHORTLISTED", "COMPLETED")).toBe(false)
    expect(canOfferGrowthAward("CLOSED", "READY", "COMPLETED")).toBe(false)
    expect(canOfferGrowthAward("CLOSED", "SHORTLISTED", "FAILED")).toBe(false)
  })

  it("redacts volunteered contact details from AI assessment text", () => {
    expect(redactContactDetails("Contact me at founder@example.com or +234 801 234 5678. 50-149 weekly sales."))
      .toBe("Contact me at [email omitted] or [phone omitted]. 50-149 weekly sales.")
  })
})
