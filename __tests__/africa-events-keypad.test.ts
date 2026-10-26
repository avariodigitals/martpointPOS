import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handler: vi.fn(), from: vi.fn(), allowed: true, configured: true }));
vi.mock("@/app/api/africastalking/voice/callback/route", () => ({ POST: mocks.handler }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => mocks.configured, supabase: { from: mocks.from } }));
vi.mock("@/lib/africastalking", async original => ({
  ...await original<typeof import("@/lib/africastalking")>(), callbackSecretIsValid: () => mocks.allowed,
  storeAfricaWebhookEvent: async () => null, finishAfricaWebhookEvent: vi.fn(), resolveAfricaBusinessId: async () => "business-1",
}));
import { POST } from "@/app/api/africastalking/voice/events/route";
const request = () => new Request("https://example.test/events?secret=test", { method: "POST", body: new URLSearchParams({ callerNumber: "+2348000000001", destinationNumber: "+2348000000000", sessionId: "provider-1", dtmfDigits: "2", isActive: "1", callSessionState: "Ringing" }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.allowed = true; mocks.configured = true;
  mocks.handler.mockResolvedValue(new Response('<Response><Dial phoneNumbers="test-destination"/></Response>', { headers: { "Content-Type": "text/xml" } }));
  mocks.from.mockImplementation(() => {
    const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: { id: "pending-call" }, error: null }) }; return q;
  });
});
describe("Keypresses arriving at the configured Events URL", () => {
  it("returns the native call flow XML rather than ignoring the keypress with JSON", async () => {
    const response = await POST(request());
    expect(await response.text()).toContain("<Dial");
    expect(mocks.handler).toHaveBeenCalledOnce();
    expect(await (mocks.handler.mock.calls[0][0] as Request).text()).toContain("dtmfDigits=2");
  });
  it("still rejects a callback with invalid authentication", async () => {
    mocks.allowed = false; expect((await POST(request())).status).toBe(403); expect(mocks.handler).not.toHaveBeenCalled();
  });
});
