import { beforeEach, describe, expect, it, vi } from "vitest"
const f = vi.hoisted(() => ({
  session: { userId: "agent-one", name: "Amaka", username: "amaka", role: "Admin" },
  denied: false,
  voice: true,
  write: true,
  profile: true,
  call: true,
  fail: false,
  queries: [] as { table: string; filters: Record<string, unknown>; scope?: string }[],
  insert: vi.fn(),
  audit: vi.fn()
}))
vi.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: vi.fn(async () =>
    f.denied
      ? { denied: Response.json({ error: "Forbidden" }, { status: 403 }), session: null }
      : { denied: null, session: f.session }
  ),
  hasPermission: (_role: string, permission: string) => (permission === "azera" ? f.voice : f.write)
}))
vi.mock("@/lib/audit", () => ({
  auditContextFromSession: () => ({ actorType: "ADMIN", actorId: f.session.userId }),
  recordAudit: f.audit
}))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => {
      const trace: { table: string; filters: Record<string, unknown>; scope?: string } = {
        table,
        filters: {}
      }
      f.queries.push(trace)
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          trace.filters[key] = value
          return q
        },
        is: () => q,
        or: (scope: string) => {
          trace.scope = scope
          return q
        },
        order: () => q,
        range: async () => ({
          data: [{ id: "call-one" }],
          count: 21,
          error: f.fail ? { message: "schema" } : null
        }),
        maybeSingle: async () => ({
          data:
            table === "azera_calls"
              ? f.call
                ? { id: "call-one" }
                : null
              : f.profile
                ? {
                    id: "11111111-1111-4111-8111-111111111111",
                    application_id: "22222222-2222-4222-8222-222222222222",
                    created_creator_id: "11111111-1111-4111-8111-111111111111"
                  }
                : null,
          error: null
        }),
        insert: (data: unknown) => {
          f.insert(data)
          return q
        },
        single: async () => ({ data: { id: "summary-one" }, error: f.fail ? { message: "failed" } : null })
      }
      return q
    }
  }
}))
import { creatorCallHistory } from "@/lib/creator-call-history"
const creator = "11111111-1111-4111-8111-111111111111",
  app = "22222222-2222-4222-8222-222222222222",
  callId = "33333333-3333-4333-8333-333333333333"
const read = () => creatorCallHistory(new Request("https://example.test/calls"), creator, "creator")
const write = (extra: Record<string, unknown> = {}) =>
  creatorCallHistory(
    new Request("https://example.test/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callId,
        summary: "Discussed next campaign steps.",
        outcome: "discussed",
        ...extra
      })
    }),
    creator,
    "creator"
  )
beforeEach(() => {
  vi.clearAllMocks()
  f.denied = false
  f.voice = true
  f.write = true
  f.profile = true
  f.call = true
  f.fail = false
  f.queries = []
})
describe("creator call audit", () => {
  it("requires creator and calling access before reading history", async () => {
    f.denied = true
    expect((await read()).status).toBe(403)
    f.denied = false
    f.voice = false
    expect((await read()).status).toBe(403)
    expect(f.queries).toHaveLength(0)
  })
  it("queries exact creator/application IDs, never a phone-number match", async () => {
    const response = await read()
    const json = await response.json()
    expect(json.total).toBe(21)
    expect(json.hasMore).toBe(true)
    expect(f.queries.find((q) => q.table === "azera_calls")?.scope).toBe(
      `creator_id.eq.${creator},creator_application_id.eq.${app}`
    )
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
  it("shows application-era calls after creator approval", async () => {
    await creatorCallHistory(new Request("https://example.test/calls"), app, "application")
    expect(f.queries.find((q) => q.table === "azera_calls")?.scope).toBe(
      `creator_id.eq.${creator},creator_application_id.eq.${app}`
    )
  })
  it("does not report an empty history if its schema is unavailable", async () => {
    f.fail = true
    expect((await read()).status).toBe(503)
  })
  it("rejects unknown and invalid profiles", async () => {
    f.profile = false
    expect((await read()).status).toBe(404)
    expect(
      (await creatorCallHistory(new Request("https://example.test/calls"), "bad-id", "creator")).status
    ).toBe(400)
  })
  it("binds summary author to session and appends an audit entry", async () => {
    expect((await write({ author_user_id: "attacker", author_name: "Impersonation" })).status).toBe(201)
    expect(f.insert).toHaveBeenCalledWith(
      expect.objectContaining({ author_user_id: "agent-one", author_name: "Amaka", call_id: callId })
    )
    expect(f.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "CREATOR_CALL_SUMMARY_ADDED", entityId: callId })
    )
  })
  it("refuses summaries on another creator's call", async () => {
    f.call = false
    expect((await write()).status).toBe(404)
    expect(f.insert).not.toHaveBeenCalled()
  })
  it("enforces summary write permissions independently of view access", async () => {
    f.write = false
    expect((await read()).status).toBe(200)
    expect((await write()).status).toBe(403)
    expect(f.insert).not.toHaveBeenCalled()
  })
  it("rejects blank or excessive notes and unrecognized outcomes", async () => {
    for (const values of [{ summary: " " }, { summary: "x".repeat(5001) }, { outcome: "invented" }])
      expect((await write(values)).status).toBe(400)
    expect(f.insert).not.toHaveBeenCalled()
  })
  it("does not claim that an unpersisted summary is saved", async () => {
    f.fail = true
    expect((await write()).status).toBe(503)
    expect(f.audit).not.toHaveBeenCalled()
  })
})
