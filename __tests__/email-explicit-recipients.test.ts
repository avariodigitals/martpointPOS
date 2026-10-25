import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ insert: vi.fn(), fetch: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: { data: { email: { provider: "resend", resendApiKey: "test-only-key", fromEmail: "sender@example.test", notifyEmail: "fallback@example.test", routes: { onboarding_access: "internal@example.test" } } } }, error: null }) }) }),
  insert: mocks.insert,
}) } }))
vi.mock("@/lib/email-templates", () => ({ ensureBrandedHtml: (_html: string, options: { text: string }) => options.text }))
vi.mock("@/lib/settings", () => ({ getEmailFooterSettings: async () => ({}) }))
import { clearEmailSettingsCache, sendEmail } from "@/lib/email"

beforeEach(() => {
  vi.clearAllMocks()
  clearEmailSettingsCache()
  mocks.insert.mockResolvedValue({ error: null })
  mocks.fetch.mockResolvedValue(new Response('{"id":"test-only-provider-id"}', { status: 200 }))
  vi.stubGlobal("fetch", mocks.fetch)
})
afterEach(() => vi.unstubAllGlobals())
describe("Explicit access-email recipient boundary", () => {
  it("keeps the log route but never appends internal route recipients", async () => {
    await sendEmail({ to: "chosen@example.test", subject: "Test", text: "Test", route: "onboarding_access", useRouteRecipients: false })
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).to).toEqual(["chosen@example.test"])
    expect(mocks.insert.mock.calls[0][0].metadata.route).toBe("onboarding_access")
  })
  it("does not fall back to internal recipients when the explicit list is missing", async () => {
    expect(await sendEmail({ subject: "Test", text: "Test", route: "onboarding_access", useRouteRecipients: false })).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("preserves default routing for other existing workflows", async () => {
    await sendEmail({ to: "chosen@example.test", subject: "Test", text: "Test", route: "onboarding_access" })
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).to).toEqual(["chosen@example.test", "internal@example.test"])
  })
})
