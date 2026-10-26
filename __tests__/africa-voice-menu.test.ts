import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ retries: undefined as unknown, from: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({}) }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }));
import { getAfricaVoiceConfig, isVoiceBusinessOpen } from "@/lib/africastalking";
import { departmentMenuAction, splitVoiceMenuGreeting } from "@/lib/africa-voice-menu";
beforeEach(() => {
  mocks.retries = undefined;
  mocks.from.mockImplementation(() => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { voice_menu_retry_limit: mocks.retries }, error: null }) }; return q; });
});
describe("Voice menu actions and working hours", () => {
  it.each([
    ["Welcome to MartPoint.\n\nFor sales or demos, press 1.\nFor support, press 2.", "Welcome to MartPoint.", "For sales or demos, press 1.\nFor support, press 2."],
    ["Welcome. Press 1 for Sales. Press 2 for Support.", "Welcome.", "Press 1 for Sales. Press 2 for Support."],
    ["Hello", "Hello", ""],
  ])("separates the introduction from the options: %s", (value, introduction, options) => {
    expect(splitVoiceMenuGreeting(value)).toEqual({ introduction, options });
  });
  it("uses the XML callback, not Events, for both input and no-input continuation", () => {
    const xml = departmentMenuAction("https://example.test/api/africastalking/voice/events?secret=test-only&consent-timeout=1", "Welcome", "", 1);
    expect(xml).toContain("/voice/callback?secret=test-only");
    expect(xml).not.toContain("/voice/events"); expect(xml).not.toContain("consent-timeout");
    expect(xml).toContain("menu-attempt=1"); expect(xml).toContain("<Redirect>");
  });
  it.each([[0, 0], [1, 1], [3, 3], [99, 3], [-1, 0], [undefined, 1], ["bad", 1]])("normalizes retries %s to %s without turning zero into one", async (value, expected) => {
    mocks.retries = value; expect((await getAfricaVoiceConfig("business-1")).menuRetryLimit).toBe(expected);
  });
  it("uses configured West Africa working hours, not the server's timezone", () => {
    const schedule = { mon: { open: "09:00", close: "17:00" } };
    expect(isVoiceBusinessOpen("Africa/Lagos", schedule, [], new Date("2026-10-26T07:59:00Z"))).toBe(false);
    expect(isVoiceBusinessOpen("Africa/Lagos", schedule, [], new Date("2026-10-26T08:00:00Z"))).toBe(true);
    expect(isVoiceBusinessOpen("Africa/Lagos", schedule, [], new Date("2026-10-26T15:59:00Z"))).toBe(true);
    expect(isVoiceBusinessOpen("Africa/Lagos", schedule, [], new Date("2026-10-26T16:00:00Z"))).toBe(false);
    expect(isVoiceBusinessOpen("Africa/Lagos", schedule, ["2026-10-26"], new Date("2026-10-26T10:00:00Z"))).toBe(false);
  });
});
