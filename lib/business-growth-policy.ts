import { z } from "zod"

export type GrowthQuestion = {
  id: string
  label: string
  type: "text" | "textarea" | "select"
  required: boolean
  options?: string[]
  maxLength?: number
}

export const growthQuestionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  label: z.string().trim().min(8).max(500),
  type: z.enum(["text", "textarea", "select"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(20).optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
}).strict().superRefine((question, context) => {
  if (question.type === "select" && !question.options?.length) context.addIssue({ code: "custom", message: "Select questions need answer options." })
  if (question.type !== "select" && question.options?.length) context.addIssue({ code: "custom", message: "Only select questions may contain options." })
})

export const growthQuestionnaireSchema = z.array(growthQuestionSchema).min(5).max(40).superRefine((questions, context) => {
  const ids = new Set<string>()
  questions.forEach((question, index) => {
    if (ids.has(question.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Question IDs must be unique." })
    ids.add(question.id)
  })
})

export const DEFAULT_GROWTH_QUESTIONS: GrowthQuestion[] = [
  { id: "operating_since", label: "How long has your business been operating?", type: "select", required: true, options: ["Not yet operating", "Under 6 months", "6–12 months", "1–3 years", "Over 3 years"] },
  { id: "store_scope", label: "Do you operate one store or several? Which single store would use this licence?", type: "textarea", required: true, maxLength: 1200 },
  { id: "weekly_transactions", label: "Approximately how many transactions does this store complete in a typical week?", type: "select", required: true, options: ["Under 10", "10–49", "50–149", "150+", "Not sure"] },
  { id: "current_process", label: "How do you currently record sales, stock, payments and customer information?", type: "textarea", required: true, maxLength: 1800 },
  { id: "challenges", label: "What are your two biggest operational challenges? Give one recent example of how either affected your business.", type: "textarea", required: true, maxLength: 2400 },
  { id: "previous_attempts", label: "What have you already tried to improve these challenges? What worked or did not work?", type: "textarea", required: true, maxLength: 1800 },
  { id: "capabilities", label: "Which MartPoint Basic capabilities would you use regularly, and what would you use each for?", type: "textarea", required: true, maxLength: 1800 },
  { id: "basic_fit", label: "Can you use the existing Basic package without custom development?", type: "select", required: true, options: ["Yes", "No", "Unsure"] },
  { id: "90_day_goal", label: "What would you like to improve within your first 90 days? How could we tell whether it improved?", type: "textarea", required: true, maxLength: 1800 },
  { id: "operator", label: "Who will be responsible for setting up and using MartPoint? Who will cover when they are unavailable?", type: "textarea", required: true, maxLength: 1200 },
  { id: "records_readiness", label: "What records can you prepare for onboarding?", type: "select", required: true, options: ["Ready now", "Can prepare within 14 days", "Need guidance", "Cannot prepare yet"] },
  { id: "barriers", label: "What could make it difficult for your business to use MartPoint consistently?", type: "textarea", required: true, maxLength: 1500 },
  { id: "reviews_commitment", label: "Can you begin standard onboarding within 14 days and participate in brief 30-, 60- and 90-day reviews?", type: "select", required: true, options: ["Yes", "No", "Need to discuss"] },
  { id: "paid_tool_history", label: "Have you previously used a paid business tool? If yes, why did you continue or stop?", type: "textarea", required: false, maxLength: 1200 },
  { id: "renewal_value", label: "After the sponsored year, what would MartPoint need to achieve for you to consider paying to continue?", type: "textarea", required: true, maxLength: 1500 },
  { id: "renewal_intention", label: "The current Basic annual licence price is shown on this page. If MartPoint delivers the improvements you described, how would your business approach renewal?", type: "select", required: true, options: ["We could budget for renewal if the value is demonstrated", "We would need to plan or save towards renewal", "We would need further approval before deciding", "We expect to use only the sponsored year", "We are unsure and would need to assess the results"] },
  { id: "renewal_authority", label: "Who would approve a paid renewal, and how does your business normally budget for annual operating expenses?", type: "textarea", required: true, maxLength: 1200 },
  { id: "essential_requirement", label: "Is there any essential requirement you are unsure MartPoint currently supports?", type: "textarea", required: true, maxLength: 1200 },
  { id: "ready_now", label: "Why is your business ready to make use of this opportunity now?", type: "textarea", required: true, maxLength: 1500 },
]

export const DEFAULT_GROWTH_RUBRIC = {
  product_fit: { label: "Fit with existing Basic capabilities", max: 30 },
  challenge_fit: { label: "Concrete operational problem and useful intended outcome", max: 25 },
  readiness: { label: "Named operator, prepared records and onboarding readiness", max: 25 },
  ongoing_value: { label: "Realistic understanding of ongoing value and paid renewal", max: 15 },
  feedback: { label: "Willingness to provide operational feedback", max: 5 },
}

export const MAX_GROWTH_AWARDS = 3

export type GrowthCriteria = {
  product_fit: number
  challenge_fit: number
  readiness: number
  ongoing_value: number
  feedback: number
}

export function calculateGrowthScore(criteria: GrowthCriteria): number {
  return criteria.product_fit + criteria.challenge_fit + criteria.readiness + criteria.ongoing_value + criteria.feedback
}

export function growthEligibilityFlags(answers: Record<string, string>): string[] {
  const flags: string[] = []
  if (answers.operating_since === "Not yet operating") flags.push("BUSINESS_NOT_YET_OPERATING_REVIEW")
  if (answers.basic_fit === "No") flags.push("BASIC_PACKAGE_NOT_ACCEPTED_REVIEW")
  if (answers.basic_fit === "Unsure") flags.push("BASIC_PACKAGE_CLARIFICATION")
  if (!answers.operator?.trim() || /not decided|no one/i.test(answers.operator)) flags.push("OPERATOR_UNCONFIRMED")
  if (answers.records_readiness === "Cannot prepare yet") flags.push("ONBOARDING_RECORDS_NOT_READY")
  if (answers.reviews_commitment === "No") flags.push("PROGRAMME_REVIEW_COMMITMENT_UNCONFIRMED")
  return flags
}

export function canOfferGrowthAward(programmeStatus: string, applicationStatus: string, assessmentStatus: string): boolean {
  return ["CLOSED", "REVIEWING"].includes(programmeStatus)
    && applicationStatus === "SHORTLISTED"
    && assessmentStatus === "COMPLETED"
}

export function redactContactDetails(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitted]")
    .replace(/(?:\+?\d[\d\s()-]{6,}\d)/g, (candidate) => (candidate.match(/\d/g) || []).length >= 8 ? "[phone omitted]" : candidate)
}

export const growthAssessmentSchema = z.object({
  recommendation: z.enum(["SHORTLIST", "REVIEW", "NEEDS_CLARIFICATION"]),
  criteria: z.object({
    product_fit: z.number().int().min(0).max(30),
    challenge_fit: z.number().int().min(0).max(25),
    readiness: z.number().int().min(0).max(25),
    ongoing_value: z.number().int().min(0).max(15),
    feedback: z.number().int().min(0).max(5),
  }).strict(),
  summary: z.string().min(1).max(1800),
  supported_needs: z.array(z.string().max(300)).max(10),
  unsupported_or_uncertain_needs: z.array(z.string().max(300)).max(10),
  evidence: z.array(z.object({ question_id: z.string().max(80), answer_excerpt: z.string().max(500), reason: z.string().max(500) }).strict()).max(12),
  missing_information: z.array(z.string().max(300)).max(10),
  clarification_questions: z.array(z.string().max(400)).max(8),
}).strict()

export type GrowthAssessment = z.infer<typeof growthAssessmentSchema> & { total_score: number }

export function validateGrowthAnswers(questions: GrowthQuestion[], answers: unknown): { ok: true; answers: Record<string, string> } | { ok: false; error: string } {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return { ok: false, error: "Please complete the application answers." }
  const raw = answers as Record<string, unknown>
  const clean: Record<string, string> = {}
  for (const question of questions) {
    const value = raw[question.id]
    if (typeof value !== "string") {
      if (question.required) return { ok: false, error: `Please answer: ${question.label}` }
      continue
    }
    const trimmed = value.trim()
    if (question.required && !trimmed) return { ok: false, error: `Please answer: ${question.label}` }
    if (trimmed.length > (question.maxLength || 2500)) return { ok: false, error: `Your answer to “${question.label}” is too long.` }
    if (question.type === "select" && trimmed && !(question.options || []).includes(trimmed)) return { ok: false, error: `Please choose a valid option for “${question.label}”.` }
    clean[question.id] = trimmed
  }
  return { ok: true, answers: clean }
}
