import { describe, it, expect } from "vitest"
import {
  gradeQuestion,
  gradeAttempt,
  applyManualMarks,
  outcomeForPercent,
  buildPaper,
  buildGate,
  stripSecrets,
  validateTemplate,
  validateQuestion,
  type AssessmentQuestion,
  type AssessmentTemplate,
  type AssessmentTier,
  type AssessmentAssignment,
  type AssessmentAttempt,
} from "@/lib/partner-assessments"

function question(partial: Partial<AssessmentQuestion> & { id: string }): AssessmentQuestion {
  return {
    templateId: "tpl-1",
    prompt: "Question?",
    type: "SINGLE",
    options: [
      { key: "a", text: "Alpha" },
      { key: "b", text: "Beta" },
    ],
    correctKeys: ["a"],
    acceptedKeywords: [],
    keywordMode: "ANY",
    points: 1,
    requiresReview: false,
    explanation: "because",
    helpText: "",
    required: true,
    sortOrder: 0,
    ...partial,
  }
}

function template(partial: Partial<AssessmentTemplate> = {}): AssessmentTemplate {
  return {
    id: "tpl-1",
    tierId: "tier-1",
    name: "Foundations",
    description: "",
    instructions: "",
    timeLimitMinutes: 20,
    passingScore: 70,
    conditionalScore: 50,
    maxAttempts: 3,
    shuffleQuestions: false,
    shuffleOptions: false,
    questionSampleCount: null,
    showResultImmediately: true,
    showCorrectAnswers: false,
    status: "ACTIVE",
    ...partial,
  }
}

function tier(partial: Partial<AssessmentTier> = {}): AssessmentTier {
  return {
    id: "tier-1",
    code: "APPLICANT_T1",
    name: "Tier 1 — Foundations",
    description: "",
    level: 1,
    audience: "APPLICANT",
    requiredForApproval: true,
    active: true,
    ...partial,
  }
}

function assignment(partial: Partial<AssessmentAssignment> = {}): AssessmentAssignment {
  return {
    id: "asg-1",
    templateId: "tpl-1",
    audience: "APPLICANT",
    applicationId: "app-1",
    partnerId: null,
    assigneeName: "Ada",
    assigneeEmail: "ada@example.com",
    token: "tok-1",
    status: "GRADED",
    dueAt: null,
    expiresAt: null,
    attemptsUsed: 1,
    bestScore: 2,
    bestPercent: 100,
    finalOutcome: "PASS",
    waivedReason: null,
    assignedByName: "Admin",
    assignedAt: "2026-10-01T10:00:00Z",
    completedAt: "2026-10-01T10:20:00Z",
    template: template(),
    tier: tier(),
    ...partial,
  }
}

function attempt(partial: Partial<AssessmentAttempt> = {}): AssessmentAttempt {
  return {
    id: "att-1",
    assignmentId: "asg-1",
    attemptNo: 1,
    startedAt: "2026-10-01T10:00:00Z",
    deadlineAt: "2026-10-01T10:20:00Z",
    submittedAt: "2026-10-01T10:10:00Z",
    answers: {},
    grading: {},
    score: 2,
    maxScore: 2,
    percent: 100,
    outcome: "PASS",
    needsReview: false,
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNotes: null,
    ...partial,
  }
}

describe("gradeQuestion", () => {
  it("marks a correct single-choice answer", () => {
    expect(gradeQuestion(question({ id: "q1" }), ["a"])).toMatchObject({ awarded: 1, correct: true, source: "AUTO" })
  })

  it("marks a wrong single-choice answer", () => {
    expect(gradeQuestion(question({ id: "q1" }), ["b"])).toMatchObject({ awarded: 0, correct: false })
  })

  it("rejects a multi-select with a partially correct set", () => {
    const q = question({ id: "q1", type: "MULTI", correctKeys: ["a", "b"] })
    expect(gradeQuestion(q, ["a"]).correct).toBe(false)
    expect(gradeQuestion(q, ["a", "b", "c"]).correct).toBe(false)
    expect(gradeQuestion(q, ["a", "b"]).correct).toBe(true)
  })

  it("grades true/false on the true/false keys", () => {
    const q = question({ id: "q1", type: "TRUE_FALSE", correctKeys: ["false"], options: [] })
    expect(gradeQuestion(q, ["false"]).awarded).toBe(1)
    expect(gradeQuestion(q, ["true"]).awarded).toBe(0)
  })

  it("accepts a dropdown answer as a bare string", () => {
    const q = question({ id: "q1", type: "DROPDOWN" })
    expect(gradeQuestion(q, "a").correct).toBe(true)
  })

  it("auto-marks a short answer containing an accepted keyword", () => {
    const q = question({ id: "q1", type: "SHORT_TEXT", correctKeys: [], acceptedKeywords: ["payment"] })
    expect(gradeQuestion(q, "A Payment Partner").correct).toBe(true)
    expect(gradeQuestion(q, "referral only").correct).toBe(false)
  })

  it("honours ALL keyword mode", () => {
    const q = question({ id: "q1", type: "LONG_TEXT", correctKeys: [], acceptedKeywords: ["onboarding", "guidance"] })
    // ANY is the default: one hit is enough.
    expect(gradeQuestion(q, "only onboarding").correct).toBe(true)
    q.keywordMode = "ALL"
    expect(gradeQuestion(q, "only onboarding").correct).toBe(false)
    expect(gradeQuestion(q, "onboarding and usage guidance").correct).toBe(true)
  })

  it("sends an unkeyworded text answer to review rather than failing it", () => {
    const q = question({ id: "q1", type: "LONG_TEXT", correctKeys: [], acceptedKeywords: [] })
    expect(gradeQuestion(q, "my own words")).toMatchObject({ needsReview: true, source: "PENDING", awarded: 0 })
  })

  it("sends an explicitly review-flagged answer to review", () => {
    const q = question({ id: "q1", type: "SHORT_TEXT", correctKeys: [], acceptedKeywords: ["payment"], requiresReview: true })
    expect(gradeQuestion(q, "payment").needsReview).toBe(true)
  })

  it("treats a blank answer as incorrect, not pending, on objective questions", () => {
    expect(gradeQuestion(question({ id: "q1" }), undefined)).toMatchObject({ awarded: 0, needsReview: false })
  })
})

describe("gradeAttempt", () => {
  const qs = [
    question({ id: "q1", points: 1 }),
    question({ id: "q2", points: 1, correctKeys: ["b"] }),
    question({ id: "q3", type: "LONG_TEXT", points: 2, correctKeys: [], acceptedKeywords: [] }),
  ]

  it("holds the whole attempt as pending review while any answer awaits a marker", () => {
    const result = gradeAttempt(qs, { q1: ["a"], q2: ["b"], q3: "prose" }, { passingScore: 70, conditionalScore: 50 })
    expect(result).toMatchObject({ score: 2, maxScore: 4, percent: 50, needsReview: true, outcome: "PENDING_REVIEW" })
  })

  it("computes a pass once everything is auto-gradeable", () => {
    const auto = qs.map((q) => (q.type === "LONG_TEXT" ? { ...q, acceptedKeywords: ["prose"] } : q))
    const result = gradeAttempt(auto, { q1: ["a"], q2: ["b"], q3: "some prose" }, { passingScore: 70, conditionalScore: 50 })
    expect(result).toMatchObject({ score: 4, maxScore: 4, percent: 100, needsReview: false, outcome: "PASS" })
  })

  it("scores zero percent when the paper is empty rather than dividing by zero", () => {
    const result = gradeAttempt([question({ id: "q1" })], {}, { passingScore: 70, conditionalScore: 50 })
    expect(result.percent).toBe(0)
    expect(result.outcome).toBe("FAIL")
  })
})

describe("applyManualMarks", () => {
  const qs = [
    question({ id: "q1", points: 1 }),
    question({ id: "q2", type: "LONG_TEXT", points: 3, correctKeys: [], acceptedKeywords: [] }),
  ]
  const config = { passingScore: 70, conditionalScore: 50 }

  it("finalises the attempt once the last pending answer is marked", () => {
    const base = gradeAttempt(qs, { q1: ["a"], q2: "prose" }, config)
    expect(base.outcome).toBe("PENDING_REVIEW")

    const final = applyManualMarks(qs, base, { q2: { awarded: 3, note: "good answer" } }, config)
    expect(final).toMatchObject({ score: 4, maxScore: 4, percent: 100, needsReview: false, outcome: "PASS" })
    expect(final.grading.q2).toMatchObject({ source: "MANUAL", note: "good answer" })
  })

  it("clamps an over-awarded mark to the question's points", () => {
    const base = gradeAttempt(qs, { q1: ["a"], q2: "prose" }, config)
    const final = applyManualMarks(qs, base, { q2: { awarded: 99 } }, config)
    expect(final.grading.q2.awarded).toBe(3)
    expect(final.score).toBe(4)
  })

  it("stays pending when only some review answers are marked", () => {
    const three = [...qs, question({ id: "q3", type: "SHORT_TEXT", points: 1, correctKeys: [], acceptedKeywords: [] })]
    const base = gradeAttempt(three, { q1: ["a"], q2: "prose", q3: "text" }, config)
    const partial = applyManualMarks(three, base, { q2: { awarded: 3 } }, config)
    expect(partial.outcome).toBe("PENDING_REVIEW")
    expect(partial.needsReview).toBe(true)
  })
})

describe("outcomeForPercent", () => {
  it("bands a score into pass, conditional and fail", () => {
    expect(outcomeForPercent(80, 70, 50)).toBe("PASS")
    expect(outcomeForPercent(70, 70, 50)).toBe("PASS")
    expect(outcomeForPercent(69, 70, 50)).toBe("CONDITIONAL")
    expect(outcomeForPercent(50, 70, 50)).toBe("CONDITIONAL")
    expect(outcomeForPercent(49, 70, 50)).toBe("FAIL")
  })
})

describe("buildPaper", () => {
  const qs = [1, 2, 3, 4, 5].map((n) => question({ id: `q${n}`, sortOrder: n }))

  it("keeps sort order when nothing is shuffled", () => {
    expect(buildPaper(qs, template(), "seed").map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"])
  })

  it("samples the requested number of questions", () => {
    expect(buildPaper(qs, template({ questionSampleCount: 3 }), "seed")).toHaveLength(3)
  })

  it("is deterministic for the same seed and different across attempts", () => {
    const shuffled = template({ shuffleQuestions: true })
    const a = buildPaper(qs, shuffled, "asg:1").map((q) => q.id).join(",")
    expect(buildPaper(qs, shuffled, "asg:1").map((q) => q.id).join(",")).toBe(a)
    expect(a).not.toBe("q1,q2,q3,q4,q5")
    expect(buildPaper(qs, shuffled, "asg:2").map((q) => q.id).join(",")).not.toBe(a)
  })

  it("shuffles option order without touching the answer keys", () => {
    const paper = buildPaper([question({ id: "q1" })], template({ shuffleOptions: true }), "seed")[0]
    expect(paper.options).toHaveLength(2)
    expect(paper.correctKeys).toEqual(["a"])
  })
})

describe("stripSecrets", () => {
  it("removes everything the marking scheme depends on", () => {
    const q = question({ id: "q1", acceptedKeywords: ["payment"], explanation: "because" })
    const stripped = stripSecrets(q)
    expect(stripped.correctKeys).toEqual([])
    expect(stripped.acceptedKeywords).toEqual([])
    expect(stripped.explanation).toBeNull()
    expect(stripped.options).toHaveLength(2)
  })
})

describe("validateTemplate", () => {
  it("requires a tier and a name", () => {
    expect(validateTemplate({ tierId: "" })).toBe("Choose a tier for this template")
    expect(validateTemplate({ tierId: "t1", name: "  " })).toBe("Template name is required")
  })

  it("rejects a conditional mark above the pass mark", () => {
    expect(validateTemplate({ tierId: "t1", name: "X", passingScore: 50, conditionalScore: 80 }))
      .toBe("The conditional mark cannot be higher than the pass mark")
  })

  it("bounds the timer", () => {
    expect(validateTemplate({ tierId: "t1", name: "X", timeLimitMinutes: 0 })).toContain("Time limit")
    expect(validateTemplate({ tierId: "t1", name: "X", timeLimitMinutes: 600 })).toContain("Time limit")
  })

  it("accepts a sane configuration", () => {
    expect(validateTemplate({ tierId: "t1", name: "X" })).toBeNull()
  })
})

describe("validateQuestion", () => {
  it("requires options and a correct answer on objective questions", () => {
    expect(validateQuestion({ prompt: "Q", type: "SINGLE", options: [], correctKeys: ["a"], acceptedKeywords: [], keywordMode: "ANY", points: 1, requiresReview: false }))
      .toContain("at least two options")
    expect(validateQuestion({
      prompt: "Q", type: "SINGLE", options: [{ key: "a", text: "A" }, { key: "b", text: "B" }],
      correctKeys: [], acceptedKeywords: [], keywordMode: "ANY", points: 1, requiresReview: false,
    })).toContain("needs a correct answer")
  })

  it("rejects a correct key that is not one of the options", () => {
    expect(validateQuestion({
      prompt: "Q", type: "SINGLE", options: [{ key: "a", text: "A" }, { key: "b", text: "B" }],
      correctKeys: ["zz"], acceptedKeywords: [], keywordMode: "ANY", points: 1, requiresReview: false,
    })).toContain("not one of its options")
  })

  it("allows an open text question with no options at all", () => {
    expect(validateQuestion({
      prompt: "Q", type: "LONG_TEXT", options: [], correctKeys: [],
      acceptedKeywords: [], keywordMode: "ANY", points: 2, requiresReview: true,
    })).toBeNull()
  })
})

describe("buildGate", () => {
  const tiers = [
    tier({ id: "tier-1", name: "Tier 1" }),
    tier({ id: "tier-2", name: "Tier 2", level: 2 }),
    tier({ id: "tier-3", name: "Tier 3 optional", level: 3, requiredForApproval: false }),
  ]
  const assignmentFor = (tierId: string, partial: Partial<AssessmentAssignment>) =>
    assignment({ id: `asg-${tierId}`, tier: tier({ id: tierId }), ...partial })

  it("is not enforced when no required applicant tier is active", () => {
    const gate = buildGate([tier({ active: false })], [], [])
    expect(gate.enforced).toBe(false)
    expect(gate.canApprove).toBe(true)
  })

  it("blocks both approvals when a required tier has not been taken", () => {
    const gate = buildGate(tiers, [], [])
    expect(gate.canApprove).toBe(false)
    expect(gate.canApproveConditional).toBe(false)
    expect(gate.blocking).toEqual(expect.arrayContaining([expect.stringContaining("not taken")]))
  })

  it("allows full approval when every required tier passed", () => {
    const rows = [
      assignmentFor("tier-1", { finalOutcome: "PASS", bestPercent: 90 }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.canApprove).toBe(true)
    expect(gate.canApproveConditional).toBe(true)
    expect(gate.summary).toContain("full approval allowed")
  })

  it("caps at conditional approval when a required tier is only in the conditional band", () => {
    const rows = [
      assignmentFor("tier-1", { finalOutcome: "PASS", bestPercent: 90 }),
      assignmentFor("tier-2", { finalOutcome: "CONDITIONAL", bestPercent: 55 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.canApprove).toBe(false)
    expect(gate.canApproveConditional).toBe(true)
    expect(gate.blocking.join(" ")).toContain("conditional band")
  })

  it("blocks even conditional approval when a required tier failed", () => {
    const rows = [
      assignmentFor("tier-1", { finalOutcome: "FAIL", bestPercent: 20 }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.canApprove).toBe(false)
    expect(gate.canApproveConditional).toBe(false)
    expect(gate.blocking.join(" ")).toContain("failed")
  })

  it("ignores an optional tier that was never taken", () => {
    const rows = [
      assignmentFor("tier-1", { finalOutcome: "PASS", bestPercent: 90 }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 90 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.rows.find((r) => r.tierId === "tier-3")?.status).toBe("NOT_TAKEN")
    expect(gate.canApprove).toBe(true)
  })

  it("counts a waiver as clearing the tier", () => {
    const rows = [
      assignmentFor("tier-1", { status: "WAIVED", finalOutcome: "PASS", waivedReason: "10 years in retail" }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.canApprove).toBe(true)
    expect(gate.rows.find((r) => r.tierId === "tier-1")?.status).toBe("WAIVED")
  })

  it("keeps approval blocked while an answer awaits review", () => {
    const rows = [
      assignmentFor("tier-1", { status: "SUBMITTED", finalOutcome: null, bestPercent: null }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const attempts = [attempt({ assignmentId: "asg-tier-1", needsReview: true, outcome: "PENDING_REVIEW" })]
    const gate = buildGate(tiers, rows, attempts)
    expect(gate.canApprove).toBe(false)
    expect(gate.canApproveConditional).toBe(false)
    expect(gate.blocking.join(" ")).toContain("awaiting your review")
  })

  it("takes the best outcome across multiple tiers' assignments", () => {
    const rows = [
      assignmentFor("tier-1", { id: "asg-a", finalOutcome: "FAIL", bestPercent: 30 }),
      assignmentFor("tier-1", { id: "asg-b", finalOutcome: "PASS", bestPercent: 85 }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.canApprove).toBe(true)
    expect(gate.rows.find((r) => r.tierId === "tier-1")?.status).toBe("PASSED")
  })

  it("reports an assigned-but-untaken assessment as outstanding, not failed", () => {
    const rows = [
      assignmentFor("tier-1", { status: "PENDING", finalOutcome: null, bestPercent: null, attemptsUsed: 0 }),
      assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 }),
    ]
    const gate = buildGate(tiers, rows, [])
    expect(gate.rows.find((r) => r.tierId === "tier-1")?.detail).toBe("assigned, not completed")
    expect(gate.canApprove).toBe(false)
  })

  it("skips an inactive tier entirely", () => {
    const rows = [assignmentFor("tier-2", { finalOutcome: "PASS", bestPercent: 80 })]
    const gate = buildGate([tier({ active: false }), tiers[1]], rows, [])
    expect(gate.rows).toHaveLength(1)
    expect(gate.canApprove).toBe(true)
  })
})
