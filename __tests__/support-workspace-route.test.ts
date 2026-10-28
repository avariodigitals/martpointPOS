import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: { userId: "admin", role: "Admin", name: "Support" } as {
    userId: string
    role: string
    name: string
  } | null,
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  category: "SOFTWARE",
  failMessages: false
}))
vi.mock("@/lib/admin-auth", () => ({ getSession: vi.fn(async () => state.session) }))
vi.mock("@/lib/support-ticket-email", () => ({
  ticketSender: vi.fn(),
  sendTicketRequesterEmail: vi.fn(),
  sendResolutionSatisfactionEmail: vi.fn(),
  sendSatisfactionReminder: vi.fn()
}))
vi.mock("@/lib/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/support")>()),
  getSlaState: vi.fn(async () => "ON_TRACK"),
  presentSupportTicketEvents: vi.fn(async (events) => events)
}))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => {
      const info = { table, filters: {} as Record<string, unknown> }
      state.queries.push(info)
      const result = () => ({
        data:
          table === "support_tickets"
            ? [
                {
                  id: "ticket-a",
                  business_id: "business-a",
                  category: state.category,
                  business: { business_name: "Ada's shop", primary_email: "ada@example.com" }
                }
              ]
            : table === "support_ticket_messages"
              ? [{ id: "message-a", ticket_id: "ticket-a", attachment_ids: ["file-public", "file-private"] }]
              : table === "support_attachments"
                ? [
                    { id: "file-public", is_internal: false },
                    { id: "file-private", is_internal: true }
                  ]
                : [],
        error: table === "support_ticket_messages" && state.failMessages ? { message: "Failed" } : null
      })
      const query = {
        select: () => query,
        order: () => query,
        eq: (key: string, value: unknown) => {
          info.filters[key] = value
          return query
        },
        single: async () => {
          const data = result()
          return { ...data, data: data.data[0] }
        },
        then: <T>(resolve: (value: ReturnType<typeof result>) => T) => Promise.resolve(result()).then(resolve)
      }
      return query
    }
  }
}))

import { GET } from "@/app/api/admin/support/[resource]/route"
const request = () =>
  GET(new Request("http://localhost/api/admin/support/workspace?id=ticket-a"), {
    params: Promise.resolve({ resource: "workspace" })
  })

beforeEach(() => {
  state.session = { userId: "admin", role: "Admin", name: "Support" }
  state.queries = []
  state.category = "SOFTWARE"
  state.failMessages = false
})

describe("selected support workspace endpoint", () => {
  it("requires authentication before reading any ticket", async () => {
    state.session = null
    expect((await request()).status).toBe(401)
    expect(state.queries).toHaveLength(0)
  })
  it("rejects roles without support access", async () => {
    state.session!.role = "Editor"
    expect((await request()).status).toBe(403)
    expect(state.queries).toHaveLength(0)
  })
  it("does not read conversations for sensitive tickets without permission", async () => {
    state.session!.role = "Tech"
    state.category = "BILLING"
    expect((await request()).status).toBe(404)
    expect(state.queries.map((query) => query.table)).toEqual(["support_tickets"])
  })
  it("returns only the requested ticket and thread without reloading inbox/settings/subscriptions", async () => {
    const response = await request()
    const json = await response.json()
    expect(json.data.ticket.id).toBe("ticket-a")
    expect(json.data.messages[0].ticket_id).toBe("ticket-a")
    expect(
      state.queries.every(
        (query) => query.filters[query.table === "support_tickets" ? "id" : "ticket_id"] === "ticket-a"
      )
    ).toBe(true)
    expect(state.queries.map((query) => query.table)).toEqual([
      "support_tickets",
      "support_ticket_messages",
      "support_ticket_events",
      "support_attachments"
    ])
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
  it("filters internal messages and attachments for public-only staff", async () => {
    state.session!.role = "Sales"
    const json = await (await request()).json()
    expect(state.queries.find((query) => query.table === "support_ticket_messages")?.filters.visibility).toBe(
      "PUBLIC"
    )
    expect(json.data.messages[0].attachments.map((file: { id: string }) => file.id)).toEqual(["file-public"])
  })
  it("does not silently display an incomplete thread on a query failure", async () => {
    state.failMessages = true
    expect((await request()).status).toBe(500)
  })
})
