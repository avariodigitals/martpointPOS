import { describe, it, expect } from "vitest"
import {
  isVacancyPubliclyListed,
  isVacancyPubliclyAccessible,
  vacancyAcceptsApplications,
  deriveEffectiveStatus,
  validateScreeningAnswers,
  scoreScreeningAnswers,
  generateApplicationReference,
  generateVacancyReference,
  slugify,
  formatKobo,
  formatCompensation,
  publicApplicationStatus,
  applicationStatusLabel,
  type ScreeningQuestion,
  type VacancyStatus,
  type ApplicationStatus,
} from "@/lib/careers"
import { hasPermission, authorize, CAREERS_PERMISSIONS } from "@/lib/admin-types"

const NOW = new Date("2026-08-01T09:00:00Z")

function vacancy(overrides: Partial<{
  status: VacancyStatus
  application_opens_at: string | null
  application_closes_at: string | null
  scheduled_publish_at: string | null
  auto_close_on_deadline: boolean
  max_applications: number | null
}> = {}) {
  return {
    status: "PUBLISHED" as VacancyStatus,
    application_opens_at: null,
    application_closes_at: null,
    scheduled_publish_at: null,
    auto_close_on_deadline: true,
    max_applications: null,
    ...overrides,
  }
}

function question(overrides: Partial<ScreeningQuestion> = {}): ScreeningQuestion {
  return {
    id: "q1",
    vacancy_id: "v1",
    question_text: "Can you work 8–5 for five days?",
    answer_type: "YES_NO",
    required: true,
    knockout: false,
    correct_answer: null,
    sort_order: 0,
    options: [],
    ...overrides,
  }
}

describe("vacancy visibility", () => {
  it("draft vacancies are never publicly listed", () => {
    expect(isVacancyPubliclyListed(vacancy({ status: "DRAFT" }), NOW)).toBe(false)
    expect(isVacancyPubliclyAccessible(vacancy({ status: "DRAFT" }))).toBe(false)
  })

  it("published vacancies inside the window are listed", () => {
    expect(isVacancyPubliclyListed(vacancy(), NOW)).toBe(true)
  })

  it("published vacancies before their opening date are not listed", () => {
    expect(
      isVacancyPubliclyListed(vacancy({ application_opens_at: "2026-08-10T00:00:00Z" }), NOW)
    ).toBe(false)
  })

  it("published vacancies past their deadline are not listed", () => {
    expect(
      isVacancyPubliclyListed(vacancy({ application_closes_at: "2026-07-31T23:59:00Z" }), NOW)
    ).toBe(false)
  })

  it("closed vacancies reject applications but remain publicly accessible", () => {
    const v = vacancy({ status: "CLOSED" })
    expect(vacancyAcceptsApplications(v, 0, NOW)).toBe(false)
    expect(isVacancyPubliclyAccessible(v)).toBe(true)
  })

  it("paused vacancies reject applications but remain publicly accessible", () => {
    const v = vacancy({ status: "PAUSED" })
    expect(vacancyAcceptsApplications(v, 0, NOW)).toBe(false)
    expect(isVacancyPubliclyAccessible(v)).toBe(true)
  })

  it("vacancies at the application cap reject applications", () => {
    const v = vacancy({ max_applications: 5 })
    expect(vacancyAcceptsApplications(v, 4, NOW)).toBe(true)
    expect(vacancyAcceptsApplications(v, 5, NOW)).toBe(false)
  })

  it("archived vacancies are not publicly accessible", () => {
    expect(isVacancyPubliclyAccessible(vacancy({ status: "ARCHIVED" }))).toBe(false)
  })
})

describe("lifecycle transitions", () => {
  it("scheduled vacancies publish when the scheduled time passes", () => {
    expect(
      deriveEffectiveStatus(
        vacancy({ status: "SCHEDULED", scheduled_publish_at: "2026-07-31T00:00:00Z" }),
        NOW
      )
    ).toBe("PUBLISHED")
  })

  it("scheduled vacancies stay scheduled before their publish time", () => {
    expect(
      deriveEffectiveStatus(
        vacancy({ status: "SCHEDULED", scheduled_publish_at: "2026-08-02T00:00:00Z" }),
        NOW
      )
    ).toBe("SCHEDULED")
  })

  it("published vacancies auto-close after the deadline", () => {
    expect(
      deriveEffectiveStatus(
        vacancy({ application_closes_at: "2026-07-31T00:00:00Z" }),
        NOW
      )
    ).toBe("CLOSED")
  })

  it("deadline auto-close respects the opt-out flag", () => {
    expect(
      deriveEffectiveStatus(
        vacancy({ application_closes_at: "2026-07-31T00:00:00Z", auto_close_on_deadline: false }),
        NOW
      )
    ).toBe("PUBLISHED")
  })
})

describe("screening answers", () => {
  it("required questions must be answered", () => {
    const errors = validateScreeningAnswers([question()], [])
    expect(errors.q1).toBe("This question is required")
  })

  it("optional questions can be left empty", () => {
    const errors = validateScreeningAnswers([question({ required: false })], [])
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it("yes/no answers must be yes or no", () => {
    expect(validateScreeningAnswers([question()], [{ questionId: "q1", text: "yes" }])).toEqual({})
    expect(validateScreeningAnswers([question()], [{ questionId: "q1", text: "maybe" }])).toHaveProperty("q1")
  })

  it("single choice answers must be a configured option", () => {
    const q = question({
      answer_type: "SINGLE_CHOICE",
      options: [
        { id: "o1", option_text: "Ilobu" },
        { id: "o2", option_text: "Osogbo" },
      ],
    })
    expect(validateScreeningAnswers([q], [{ questionId: "q1", options: ["Ilobu"] }])).toEqual({})
    expect(validateScreeningAnswers([q], [{ questionId: "q1", options: ["Abuja"] }])).toHaveProperty("q1")
  })

  it("number answers must be numeric", () => {
    const q = question({ answer_type: "NUMBER" })
    expect(validateScreeningAnswers([q], [{ questionId: "q1", text: "5" }])).toEqual({})
    expect(validateScreeningAnswers([q], [{ questionId: "q1", text: "five" }])).toHaveProperty("q1")
  })

  it("file answers require an attached document", () => {
    const q = question({ answer_type: "FILE" })
    expect(validateScreeningAnswers([q], [{ questionId: "q1" }])).toHaveProperty("q1")
    expect(validateScreeningAnswers([q], [{ questionId: "q1", fileDocumentId: "doc1" }])).toEqual({})
  })

  it("scores knockout questions against correct answers", () => {
    const qs = [
      question({ id: "a", correct_answer: "yes" }),
      question({ id: "b", correct_answer: "no" }),
    ]
    const { score, max, passed } = scoreScreeningAnswers(
      qs,
      [
        { questionId: "a", text: "yes" },
        { questionId: "b", text: "no" },
      ],
      50
    )
    expect(score).toBe(100)
    expect(max).toBe(2)
    expect(passed).toBe(true)
  })

  it("fails applicants below the pass score", () => {
    const qs = [
      question({ id: "a", correct_answer: "yes" }),
      question({ id: "b", correct_answer: "yes" }),
    ]
    const { score, passed } = scoreScreeningAnswers(
      qs,
      [
        { questionId: "a", text: "yes" },
        { questionId: "b", text: "no" },
      ],
      75
    )
    expect(score).toBe(50)
    expect(passed).toBe(false)
  })
})

describe("references and slugs", () => {
  it("application references are unguessable and non-sequential", () => {
    const a = generateApplicationReference()
    const b = generateApplicationReference()
    expect(a).toMatch(/^MPC-\d{4}-[A-Z2-9]{6}$/)
    expect(b).toMatch(/^MPC-\d{4}-[A-Z2-9]{6}$/)
    expect(a).not.toBe(b)
    // No ambiguous characters (0, O, 1, I) in the suffix
    expect(a.split("-")[2]).not.toMatch(/[01OI]/)
  })

  it("vacancy references use the MPV prefix", () => {
    expect(generateVacancyReference()).toMatch(/^MPV-\d{4}-[A-Z2-9]{5}$/)
  })

  it("slugifies job titles", () => {
    expect(slugify("Temporary Inventory Officer — Ilobu!")).toBe("temporary-inventory-officer-ilobu")
    expect(slugify("  Inventory Team Lead ")).toBe("inventory-team-lead")
  })
})

describe("compensation display", () => {
  it("formats kobo as naira", () => {
    expect(formatKobo(1000000)).toBe("₦10,000")
    expect(formatKobo(2500000)).toBe("₦25,000")
  })

  it("hides compensation when show_compensation is false", () => {
    expect(
      formatCompensation({
        compensation_type: "DAILY",
        compensation_min_kobo: 1000000,
        compensation_max_kobo: null,
        currency: "NGN",
        show_compensation: false,
      })
    ).toBeNull()
  })

  it("hides negotiable compensation", () => {
    expect(
      formatCompensation({
        compensation_type: "NEGOTIABLE",
        compensation_min_kobo: null,
        compensation_max_kobo: null,
        currency: "NGN",
        show_compensation: true,
      })
    ).toBeNull()
  })

  it("shows a daily rate", () => {
    expect(
      formatCompensation({
        compensation_type: "DAILY",
        compensation_min_kobo: 1000000,
        compensation_max_kobo: null,
        currency: "NGN",
        show_compensation: true,
      })
    ).toBe("₦10,000 per day")
  })

  it("shows a range when min and max differ", () => {
    expect(
      formatCompensation({
        compensation_type: "MONTHLY",
        compensation_min_kobo: 10000000,
        compensation_max_kobo: 15000000,
        currency: "NGN",
        show_compensation: true,
      })
    ).toBe("₦100,000 – ₦150,000 per month")
  })
})

describe("public status lookup", () => {
  it("maps internal statuses to safe public labels", () => {
    expect(publicApplicationStatus("NEW")).toBe("Application received")
    expect(publicApplicationStatus("REJECTED")).toBe("Not selected")
    expect(publicApplicationStatus("BLACKLISTED")).toBe("Not selected")
    expect(publicApplicationStatus("SHORTLISTED")).toBe("Shortlisted")
  })

  it("never exposes internal workflow detail", () => {
    for (const s of ["SCREENING_PASSED", "SCREENING_FAILED", "UNDER_REVIEW", "RESERVE"]) {
      const pub = publicApplicationStatus(s as ApplicationStatus)
      expect(pub).not.toMatch(/score|note|reviewer|fail|pass/i)
    }
  })

  it("admin label helper falls back gracefully", () => {
    expect(applicationStatusLabel("SHORTLISTED")).toBe("Shortlisted")
    expect(applicationStatusLabel("SOME_UNKNOWN")).toBe("SOME UNKNOWN")
  })
})

describe("careers permissions", () => {
  it("Admin is authorized for every careers permission", () => {
    const admin = { userId: "u1", username: "admin", role: "Admin" as const, name: "Admin" }
    for (const p of CAREERS_PERMISSIONS) {
      expect(authorize(admin, p)).toBe(true)
    }
  })

  it("HR Manager has full careers access except settings", () => {
    expect(hasPermission("HR Manager", "careers.vacancies.publish")).toBe(true)
    expect(hasPermission("HR Manager", "careers.applications.export")).toBe(true)
    expect(hasPermission("HR Manager", "careers.settings.manage")).toBe(false)
  })

  it("Reviewer can only view and review applications", () => {
    expect(hasPermission("Reviewer", "careers.applications.view")).toBe(true)
    expect(hasPermission("Reviewer", "careers.applications.review")).toBe(true)
    expect(hasPermission("Reviewer", "careers.vacancies.create")).toBe(false)
    expect(hasPermission("Reviewer", "careers.applications.delete")).toBe(false)
    expect(hasPermission("Reviewer", "careers.talent_pool.manage")).toBe(false)
  })

  it("Hiring Manager cannot publish vacancies or manage deployments", () => {
    expect(hasPermission("Hiring Manager", "careers.vacancies.view")).toBe(true)
    expect(hasPermission("Hiring Manager", "careers.vacancies.publish")).toBe(false)
    expect(hasPermission("Hiring Manager", "careers.deployments.manage")).toBe(false)
  })

  it("Deployment Supervisor has deployments only", () => {
    expect(hasPermission("Deployment Supervisor", "careers.deployments.manage")).toBe(true)
    expect(hasPermission("Deployment Supervisor", "careers.applications.view")).toBe(false)
  })

  it("Finance sees deployment summaries only", () => {
    expect(hasPermission("Finance", "careers.deployments.view")).toBe(true)
    expect(hasPermission("Finance", "careers.applications.view")).toBe(false)
    expect(hasPermission("Finance", "careers.vacancies.create")).toBe(false)
  })

  it("non-careers roles have no careers access", () => {
    expect(hasPermission("Editor", "careers.applications.view")).toBe(false)
    expect(hasPermission("Sales", "careers.dashboard.view")).toBe(false)
  })
})

/* ─── Interview invites, offers & status templates ─── */

import { templateForStatusChange, buildInterviewVars, buildInterviewIcs } from "@/lib/careers-notifications"

describe("career notification templates", () => {
  it("maps pipeline statuses to applicant-facing templates", () => {
    expect(templateForStatusChange("SHORTLISTED")).toBe("career_shortlisted")
    expect(templateForStatusChange("UNDER_REVIEW")).toBe("career_under_review")
    expect(templateForStatusChange("ASSESSMENT_INVITED")).toBe("career_assessment_invite")
    expect(templateForStatusChange("SELECTED")).toBe("career_selected")
    expect(templateForStatusChange("RESERVE")).toBe("career_reserve")
    expect(templateForStatusChange("REJECTED")).toBe("career_rejection")
  })

  it("does not notify for internal-only statuses", () => {
    for (const s of ["NEW", "SCREENING_PASSED", "SCREENING_FAILED", "ASSESSMENT_COMPLETED", "VERIFIED", "DEPLOYED", "COMPLETED", "WITHDRAWN", "BLACKLISTED"]) {
      expect(templateForStatusChange(s)).toBeNull()
    }
  })
})

describe("interview invites", () => {
  const base = {
    fullName: "Ada Okafor", reference: "MPC-2026-ABC123", vacancyTitle: "Inventory Team Lead",
    assessmentName: "Panel interview", scheduledAt: new Date("2026-08-10T09:00:00Z"),
    durationMinutes: 45, meetingLink: "https://meet.google.com/abc-defg-hij",
    meetingLocation: null, instructions: "Bring a valid ID.", statusUrl: "https://martpoint.com.ng/careers/application-status",
  }

  it("includes a join button and join line when a meeting link exists", () => {
    const vars = buildInterviewVars(base)
    expect(vars.joinBlock).toContain("https://meet.google.com/abc-defg-hij")
    expect(vars.joinBlock).toContain("Join Video Interview")
    expect(vars.joinLine).toContain("meet.google.com")
    expect(vars.interviewWhen).toContain("August")
    expect(vars.durationMinutes).toBe(45)
  })

  it("omits the join block for in-person interviews and shows the venue", () => {
    const vars = buildInterviewVars({ ...base, meetingLink: null, meetingLocation: "MartPoint Office, Osogbo" })
    expect(vars.joinBlock).toBe("")
    expect(vars.joinLine).toBe("")
    expect(vars.locationLine).toContain("MartPoint Office, Osogbo")
    expect(vars.locationBlock).toContain("MartPoint Office, Osogbo")
  })

  it("builds a valid .ics calendar attachment", () => {
    const ics = buildInterviewIcs({
      id: "test-1", summary: "Interview: Panel interview — Inventory Team Lead",
      start: base.scheduledAt, durationMinutes: 45,
      attendeeEmail: "ada@example.com", attendeeName: "Ada Okafor",
      meetingLink: base.meetingLink, location: null,
    })
    const text = Buffer.from(ics.content, "base64").toString()
    expect(ics.filename).toBe("interview.ics")
    expect(text).toContain("BEGIN:VCALENDAR")
    expect(text).toContain("DTSTART:20260810T090000Z")
    expect(text).toContain("DTEND:20260810T094500Z")
    expect(text).toContain("SUMMARY:Interview: Panel interview — Inventory Team Lead")
    expect(text).toContain("LOCATION:https://meet.google.com/abc-defg-hij")
    expect(text).toContain("ATTENDEE")
  })

  it("uses the venue as the ICS location when there is no meeting link", () => {
    const ics = buildInterviewIcs({
      id: "test-2", summary: "Interview", start: base.scheduledAt, durationMinutes: 30,
      meetingLink: null, location: "MartPoint Office",
    })
    const text = Buffer.from(ics.content, "base64").toString()
    expect(text).toContain("LOCATION:MartPoint Office")
    expect(text).not.toContain("Join:")
  })
})
