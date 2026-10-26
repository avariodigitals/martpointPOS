import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prepared: vi.fn(), events: vi.fn(), allowed: true }));
vi.mock("@/lib/africa-browser-routing", async original => ({
  ...await original<typeof import("@/lib/africa-browser-routing")>(), preparedAfricaOutbound: mocks.prepared,
}));
vi.mock("@/lib/africastalking", async original => ({
  ...await original<typeof import("@/lib/africastalking")>(), callbackSecretIsValid: () => mocks.allowed,
  storeAfricaWebhookEvent: async () => "event-1", finishAfricaWebhookEvent: vi.fn(),
}));
vi.mock("@/app/api/africastalking/voice/events/route", () => ({ POST: mocks.events }));
import { POST } from "@/app/api/africastalking/voice/callback/route";
const request = (values: Record<string, string> = {}) => new Request("https://example.test/callback?secret=test", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ callerNumber: "martpoint.mp_123", sessionId: "ATVId_123", destinationNumber: "+2348000000000", clientDialedNumber: "08000000001", isActive: "1", ...values }),
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.allowed = true;
  mocks.prepared.mockResolvedValue({ id: "call-1", status: "ringing", sip_to_number: "+2348000000001", sip_from_number: "+2348000000000" });
  mocks.events.mockResolvedValue(Response.json({ ok: true }));
});
describe("Browser-originated voice callback", () => {
  it("bridges the stored destination directly instead of playing the incoming IVR", async () => {
    const xml = await (await POST(request())).text();
    expect(xml).toContain('phoneNumbers="+2348000000001"');
    expect(xml).toContain('callerId="+2348000000000"');
    expect(xml).not.toContain("GetDigits"); expect(xml).not.toContain('record="true"');
    expect(mocks.prepared).toHaveBeenCalledWith("martpoint.mp_123", "+2348000000001", "ATVId_123");
  });
  it("does not Dial an unrecognised or tampered outgoing call", async () => {
    mocks.prepared.mockResolvedValue(null);
    expect(await (await POST(request())).text()).not.toContain("<Dial");
  });
  it("does not redial completed outgoing preparations", async () => {
    mocks.prepared.mockResolvedValue({ status: "ended" });
    expect(await (await POST(request())).text()).not.toContain("<Dial");
  });
  it("handles final notifications on the callback as events, not new calls", async () => {
    const xml = await (await POST(request({ isActive: "0", callSessionState: "Completed" }))).text();
    expect(xml).not.toContain("<Dial"); expect(mocks.events).toHaveBeenCalledOnce(); expect(mocks.prepared).not.toHaveBeenCalled();
  });
  it("asks for a provider retry if event persistence fails", async () => {
    mocks.events.mockResolvedValue(Response.json({ ok: false }, { status: 503 }));
    expect((await POST(request({ isActive: "0" }))).status).toBe(503);
  });
  it("does not redial a bridged call when live notifications hit the callback", async () => {
    const xml = await (await POST(request({ callSessionState: "Bridged" }))).text();
    expect(xml).not.toContain("<Dial"); expect(mocks.events).toHaveBeenCalledOnce(); expect(mocks.prepared).not.toHaveBeenCalled();
  });
  it("keeps secret validation mandatory", async () => {
    mocks.allowed = false;
    expect((await POST(request())).status).toBe(403); expect(mocks.prepared).not.toHaveBeenCalled();
  });
});
