import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { mergeInboxMessages, type InboxMessage } from "@/lib/omnichannel-state"
import { OmnichannelDetails } from "@/components/admin/omnichannel-details"

const row = (id: string, partial: Partial<InboxMessage> = {}): InboxMessage => ({ id, author_type: "customer", direction: "inbound", message: id, created_at: "2026-10-24T18:00:00Z", ...partial })
describe("Omnichannel background message updates", () => {
  it("keeps unchanged rows and the list identity instead of restarting the thread", () => {
    const current = [row("1"), row("2")]
    expect(mergeInboxMessages(current, current.map((item) => ({ ...item })))).toBe(current)
  })
  it("appends new messages without losing history or pending sends", () => {
    const old = row("old", { created_at: "2026-10-24T17:00:00Z" })
    const pending = row("optimistic-unique", { author_type: "agent", created_at: "2026-10-24T18:01:00Z" })
    expect(mergeInboxMessages([old, pending], [row("new")])).toEqual([old, row("new"), pending])
  })
  it("reconciles a pending message once, even when polling wins the send-response race", () => {
    const pending = row("optimistic-unique", { author_type: "agent" })
    const saved = row("server-id", { author_type: "agent", metadata: { client_message_id: pending.id } })
    const next = mergeInboxMessages([pending], [saved])
    expect(next).toEqual([saved])
    expect(mergeInboxMessages(next, [saved])).toBe(next)
  })
  it("updates changed messages in place without duplicating ids", () => {
    expect(mergeInboxMessages([row("1")], [row("1", { message: "updated" })])).toEqual([row("1", { message: "updated" })])
  })
})

describe("Desktop conversation details", () => {
  it("renders readable labeled status, a real ticket link and dated activity without a device dialer", () => {
    const html = renderToStaticMarkup(<OmnichannelDetails conversation={{ id: "1", customer_name: "Test Contact", customer_phone: "+2348000000000", external_id: "visitor", ai_enabled: false, ticket_id: "ticket-1", status: "open", last_message_at: "2026-10-24T20:44:00Z", waiting_for_agent: false, escalation_reason: null, queue: "sales", knowledge_refs: [] }} email="test@example.test" callBusy={false} onCall={() => {}} onTicket={() => {}} onUpload={() => {}} onInvite={() => {}} />)
    expect(html).toContain("AI assistant")
    expect(html).toContain("Paused")
    expect(html).toContain("Support ticket")
    expect(html).toContain("/admin/support?id=ticket-1")
    expect(html).toContain('dateTime="2026-10-24T20:44:00.000Z"')
    expect(html).toContain("Call in browser")
    expect(html).not.toContain("tel:")
    expect(html).toContain("xl:col-span-1")
  })
})
