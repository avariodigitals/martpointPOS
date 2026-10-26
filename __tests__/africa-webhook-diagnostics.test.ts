import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rows: [] as Record<string, unknown>[], duplicate: false }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }));
vi.mock("@/lib/settings", () => ({ getSettings: vi.fn() }));
import { storeAfricaWebhookEvent } from "@/lib/africastalking";
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = []; mocks.duplicate = false;
  mocks.from.mockImplementation(() => {
    const q = { select: () => q, eq: () => q,
      insert: (row: Record<string, unknown>) => { mocks.rows.push(row); return q; },
      single: async () => mocks.duplicate ? { data: null, error: { code: "23505" } } : { data: { id: "new-event" }, error: null },
      maybeSingle: async () => ({ data: { id: "existing-event" }, error: null }),
    }; return q;
  });
});
const input = (digit: string, stage = "") => ({
  product: "voice" as const, endpoint: "voice/callback", businessId: "business-1",
  request: new Request(`https://example.test/callback?secret=test${stage ? `&stage=${stage}` : ""}`),
  rawBody: new URLSearchParams({ sessionId: "provider-session-1", callSessionState: "Ringing", dtmfDigits: digit }).toString(),
  payload: { sessionId: "provider-session-1", callSessionState: "Ringing", dtmfDigits: digit },
});
describe("Durable keypad callback diagnostics", () => {
  it("keeps distinct keypresses from one call instead of overwriting its Ringing entry", async () => {
    await storeAfricaWebhookEvent(input("1")); await storeAfricaWebhookEvent(input("2"));
    expect(mocks.rows[0].dedupe_key).not.toBe(mocks.rows[1].dedupe_key);
  });
  it("deduplicates an exact redelivery using the existing partial unique index", async () => {
    expect(await storeAfricaWebhookEvent(input("1"))).toBe("new-event");
    mocks.duplicate = true;
    expect(await storeAfricaWebhookEvent(input("1"))).toBe("existing-event");
    expect(mocks.rows[0].dedupe_key).toBe(mocks.rows[1].dedupe_key);
  });
  it("distinguishes department and recording stages without storing the URL secret in the key", async () => {
    await storeAfricaWebhookEvent(input("1")); await storeAfricaWebhookEvent(input("1", "recording-consent"));
    expect(mocks.rows[0].dedupe_key).not.toBe(mocks.rows[1].dedupe_key);
    expect(String(mocks.rows[1].dedupe_key)).not.toContain("secret=");
  });
  it("keeps each explicit menu timeout attempt separate in diagnostics", async () => {
    const first = input("", "department-menu");
    first.request = new Request(first.request.url + "&menu-attempt=1&menu-timeout=1");
    const second = input("", "department-menu");
    second.request = new Request(second.request.url + "&menu-attempt=2&menu-timeout=1");
    await storeAfricaWebhookEvent(first); await storeAfricaWebhookEvent(second);
    expect(mocks.rows[0].dedupe_key).not.toBe(mocks.rows[1].dedupe_key);
    expect(mocks.rows[1].payload).toMatchObject({ _martpoint_callback: { menu_attempt: "2", menu_timeout: true } });
  });
});
