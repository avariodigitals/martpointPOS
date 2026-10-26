import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ from: vi.fn(), cached: vi.fn(), username: "current_app", error: null as null | { code: string } }))
vi.mock("@/lib/settings", () => ({ getSettings: mocks.cached }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
import { africaBrowserConfig, africaCapability } from "@/lib/africa-browser-voice"
beforeEach(() => {
  vi.clearAllMocks(); mocks.username = "current_app"; mocks.error = null
  mocks.cached.mockResolvedValue({ sip: { username: "stale_app", api_key: "stale-key" } })
  mocks.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ error: mocks.error, data: table === "settings" ? { data: { sip: { username: mocks.username, api_key: "current-key", from_number: "+2348000000000" } } } : { africas_talking_phone_number: "+2348000000001" } }) }
    return q
  })
})
afterEach(() => { vi.unstubAllGlobals() })
describe("Current browser-call credentials", () => {
  it("reads the saved application username on every preparation, not the website cache", async () => {
    expect((await africaBrowserConfig()).username).toBe("current_app")
    mocks.username = "corrected_app"
    expect((await africaBrowserConfig()).username).toBe("corrected_app")
    expect(mocks.cached).not.toHaveBeenCalled()
  })
  it("retains the mapped business number while refreshing the application credentials", async () => {
    expect(await africaBrowserConfig("business-1")).toMatchObject({ username: "current_app", apiKey: "current-key", phone: "+2348000000001" })
  })
  it("does not silently reuse stale authentication after a database failure", async () => {
    mocks.error = { code: "offline" }
    await expect(africaBrowserConfig()).rejects.toThrow("current Africa")
    expect(mocks.cached).not.toHaveBeenCalled()
  })
  it("reports an authentication rejection without exposing the provider response or API key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errorMessage: "sensitive provider content" }, { status: 401 })))
    await expect(africaCapability({ apiKey: "current-key", username: "app", phone: "+2348000000000" }, "client-1")).rejects.toThrow("rejected browser-call authentication")
  })
})
