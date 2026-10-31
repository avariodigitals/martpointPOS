import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ auth: vi.fn(), result: vi.fn(), operations: [] as { table: string; method: string; args: unknown[] }[] }))
vi.mock("@/lib/admin-auth", () => ({ authorizeAdmin: m.auth }))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: (table: string) => {
    const query: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "upsert", "update", "delete"]) query[method] = (...args: unknown[]) => { m.operations.push({ table, method, args }); return query }
    for (const method of ["single", "maybeSingle"]) query[method] = m.result
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(m.result()).then(resolve, reject)
    return query
  } }
}))
import { GET, PUT, DELETE } from "@/app/api/admin/email-drafts/[kind]/[entityId]/route"

const entityId = "123e4567-e89b-42d3-a456-426614174000"
const params = { params: Promise.resolve({ kind: "leads", entityId }) }
const attachment = { filename: "proposal.pdf", content: Buffer.from("document").toString("base64") }
const draft = { subject: "Still drafting", bodyHtml: "<p>Hello <strong>Ade</strong></p>", layout: "normal", attachments: [attachment], replyContext: { emailId: entityId, replyAll: true } }
const request = (body: unknown = draft) => new Request("http://localhost/draft", { method: "PUT", body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); m.result.mockReset(); m.operations.length = 0
  m.auth.mockResolvedValue({ session: { userId: "staff-id" }, denied: null })
})
describe("private saved email drafts", () => {
  it("saves formatting, reply-all state and attachment bytes under the authenticated staff member", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { updated_at: "2026-10-29T09:00:00Z" } })
    const response = await PUT(request(), params)
    expect(response.status).toBe(200)
    expect((await response.json()).saved.draft).toEqual(draft)
    expect(m.operations.find((item) => item.method === "upsert")?.args[0]).toMatchObject({ user_id: "staff-id", entity_type: "leads", entity_id: entityId, draft })
  })
  it("reads and deletes only that user's draft for the selected record", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { draft, updated_at: "now" } })
    expect((await GET(request(), params)).status).toBe(200)
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ error: null })
    expect((await DELETE(request(), params)).status).toBe(200)
    expect(m.operations.filter((item) => item.table === "email_composer_drafts" && item.method === "eq" && item.args[0] === "user_id" && item.args[1] === "staff-id")).toHaveLength(2)
    expect(m.operations.filter((item) => item.table === "email_composer_drafts" && item.method === "eq" && item.args[0] === "entity_id" && item.args[1] === entityId)).toHaveLength(2)
  })
  it("sanitizes executable draft HTML before persistence", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { updated_at: "now" } })
    const data = await (await PUT(request({ ...draft, bodyHtml: '<p>Hello</p><script>bad()</script><a href="javascript:bad()">x</a>' }), params)).json()
    expect(data.saved.draft.bodyHtml).not.toMatch(/script|javascript:/)
  })
  it("allows saving unfinished or blank messages", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { updated_at: "now" } })
    expect((await PUT(request({ subject: "", bodyHtml: "", layout: "normal" }), params)).status).toBe(200)
  })
  it("requires permission and rejects unknown destinations", async () => {
    m.auth.mockResolvedValue({ denied: new Response("Forbidden", { status: 403 }) })
    expect((await PUT(request(), params)).status).toBe(403)
    expect(m.operations).toHaveLength(0)
    expect((await GET(request(), { params: Promise.resolve({ kind: "users", entityId }) })).status).toBe(400)
  })
  it("does not save orphaned or invalid attachment drafts", async () => {
    m.result.mockResolvedValueOnce({ data: null })
    expect((await PUT(request(), params)).status).toBe(404)
    m.result.mockResolvedValueOnce({ data: { id: entityId } })
    expect((await PUT(request({ ...draft, attachments: [{ ...attachment, content: "invalid base64" }] }), params)).status).toBe(400)
    expect(m.operations.some((item) => item.method === "upsert")).toBe(false)
  })
  it("returns a small confirmation without echoing attachment bytes when requested", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { updated_at: "now" } })
    const response = await PUT(new Request("http://localhost/draft", {
      method: "PUT", headers: { Prefer: "return=minimal" }, body: JSON.stringify(draft)
    }), params)
    expect(await response.json()).toEqual({ saved: { bodyHtml: draft.bodyHtml, updatedAt: "now" } })
  })
  it("reuses attachment bytes only from this user's exact draft revision", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } })
      .mockResolvedValueOnce({ data: { draft } }).mockResolvedValueOnce({ data: { updated_at: "next" } })
    const fields = { ...draft, attachments: undefined }
    const response = await PUT(request({ ...fields, subject: "Edited", attachmentsRevision: "previous" }), params)
    expect(response.status).toBe(200)
    expect((await response.json()).saved.draft).toEqual({ ...draft, subject: "Edited" })
    expect(m.operations.find((item) => item.method === "update")?.args[0]).toMatchObject({ user_id: "staff-id", draft: { attachments: [attachment] } })
    for (const [key, value] of [["user_id", "staff-id"], ["entity_type", "leads"], ["entity_id", entityId], ["updated_at", "previous"]]) {
      expect(m.operations.filter((item) => item.table === "email_composer_drafts" && item.method === "eq" && item.args[0] === key && item.args[1] === value)).toHaveLength(2)
    }
  })
  it("rejects a stale or deleted attachment revision instead of silently losing files", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: null })
    expect((await PUT(request({ subject: "Edited", bodyHtml: "", layout: "normal", attachmentsRevision: "old" }), params)).status).toBe(409)
    expect(m.operations.some((item) => ["update", "upsert"].includes(item.method))).toBe(false)
  })
  it("rejects a concurrent update after reading reusable attachments", async () => {
    m.result.mockResolvedValueOnce({ data: { id: entityId } })
      .mockResolvedValueOnce({ data: { draft } }).mockResolvedValueOnce({ data: null })
    expect((await PUT(request({ subject: "Edited", bodyHtml: "", layout: "normal", attachmentsRevision: "old" }), params)).status).toBe(409)
  })
  it("still allows removing or replacing saved attachments", async () => {
    for (const attachments of [[], [{ ...attachment, filename: "new.pdf" }]]) {
      m.result.mockResolvedValueOnce({ data: { id: entityId } }).mockResolvedValueOnce({ data: { updated_at: "now" } })
      const response = await PUT(request({ ...draft, attachments }), params)
      expect(response.status).toBe(200)
      expect((await response.json()).saved.draft.attachments).toEqual(attachments)
    }
  })
  it("rejects mixed or malformed attachment-reuse instructions", async () => {
    for (const body of [{ ...draft, attachmentsRevision: "old" }, { ...draft, attachmentsRevision: 42 }]) {
      m.result.mockResolvedValueOnce({ data: { id: entityId } })
      expect((await PUT(request(body), params)).status).toBe(400)
    }
    expect(m.operations.some((item) => ["update", "upsert"].includes(item.method))).toBe(false)
  })
})
