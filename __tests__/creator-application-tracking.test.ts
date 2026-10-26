import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn(), calls: [] as { table: string; method: string; args: unknown[] }[], error: null as null | { message: string }, rows: [] as Record<string, unknown>[], count: 78 }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
import { listCreatorApplicationsPage } from "@/lib/creator-applications"
import type { CreatorReplyFilter } from "@/lib/creator-question-summary"

beforeEach(() => {
  vi.clearAllMocks(); mocks.calls = []; mocks.error = null; mocks.count = 78
  mocks.rows = [{ id: "app-1", full_name: "Ada", status: "MANUAL_REVIEW", question_rounds: [
    { status: "Submitted", submitted_at: "2026-10-26T10:00:00Z", first_viewed_at: "2026-10-25T10:00:00Z", initial_email_status: "SENT", next_reminder_at: null },
    { status: "Sent", submitted_at: null, first_viewed_at: null, initial_email_status: "FAILED", next_reminder_at: null },
  ] }]
  mocks.from.mockImplementation((table: string) => {
    const q: Record<string, unknown> = {}
    for (const method of ["select", "is", "not", "order", "eq", "or", "in", "range"]) {
      q[method] = (...args: unknown[]) => { mocks.calls.push({ table, method, args }); return q }
    }
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "creator_applications" ? mocks.rows : [], count: table === "creator_applications" ? mocks.count : null, error: mocks.error }).then(resolve)
    return q
  })
})

describe("Central creator application tracker query", () => {
  it("filters the database before pagination while summarising all of an applicant's rounds", async () => {
    const result = await listCreatorApplicationsPage({ response: "needs_review" }, 3, 25)
    expect(result).toMatchObject({ total: 78, page: 3, pageSize: 25, applications: [{ id: "app-1", questionSummary: { total: 2, needsReview: 1, awaiting: 1, emailFailed: 1 } }] })
    const select = mocks.calls.find((call) => call.table === "creator_applications" && call.method === "select")!
    expect(select.args[0]).toContain("question_rounds:creator_application_question_rounds(")
    expect(select.args[0]).toContain("response_filter:creator_application_question_rounds!inner(id)")
    expect(select.args[0]).not.toContain("responses")
    expect(select.args[0]).not.toContain("token")
    const statusIndex = mocks.calls.findIndex((call) => call.method === "eq" && call.args[0] === "response_filter.status")
    const rangeIndex = mocks.calls.findIndex((call) => call.method === "range")
    expect(mocks.calls[statusIndex].args).toEqual(["response_filter.status", "Submitted"])
    expect(statusIndex).toBeLessThan(rangeIndex)
    expect(mocks.calls[rangeIndex].args).toEqual([50, 74])
  })
  it.each([
    ["awaiting_response", "eq", "response_filter.status", "Sent"],
    ["opened", "not", "response_filter.first_viewed_at", "is", null],
    ["not_opened", "is", "response_filter.first_viewed_at", null],
    ["email_failed", "eq", "response_filter.initial_email_status", "FAILED"],
    ["reviewed", "eq", "response_filter.status", "Reviewed"],
    ["not_sent", "is", "response_filter", null],
  ])("applies the %s filter", async (filter, method, ...args) => {
    await listCreatorApplicationsPage({ response: filter as CreatorReplyFilter })
    expect(mocks.calls).toContainEqual({ table: "creator_applications", method, args })
    if (filter === "not_sent") expect(mocks.calls.find((call) => call.method === "select")!.args[0]).not.toContain("!inner")
  })
  it("combines reply filters with application status and search without exposing raw round data", async () => {
    const result = await listCreatorApplicationsPage({ status: "MANUAL_REVIEW", q: "Ada,(bad)%_", response: "opened" })
    expect(mocks.calls).toContainEqual({ table: "creator_applications", method: "eq", args: ["status", "MANUAL_REVIEW"] })
    expect(mocks.calls).toContainEqual({ table: "creator_applications", method: "or", args: ["full_name.ilike.%Adabad%,email.ilike.%Adabad%,reference_number.ilike.%Adabad%"] })
    expect(result.applications[0]).not.toHaveProperty("question_rounds")
  })
  it("reports a database failure instead of pretending no creators have replied", async () => {
    mocks.error = { message: "Column missing" }
    await expect(listCreatorApplicationsPage()).rejects.toThrow("Could not load")
  })
  it("returns an empty page with its count without fetching secondary data", async () => {
    mocks.rows = []
    expect(await listCreatorApplicationsPage({}, 5)).toMatchObject({ applications: [], total: 78, page: 5 })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
