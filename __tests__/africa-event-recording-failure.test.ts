import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), importRecording: vi.fn(), finish: vi.fn(), call: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }));
vi.mock("@/lib/africastalking", async original => ({
  ...await original<typeof import("@/lib/africastalking")>(),
  callbackSecretIsValid: () => true, resolveAfricaBusinessId: async () => "business-1",
  storeAfricaWebhookEvent: async () => "event-1", finishAfricaWebhookEvent: mocks.finish,
  getAfricaVoiceConfig: async () => ({ recordingRetentionDays: 90 }),
}));
vi.mock("@/lib/africa-call-recording", () => ({ importAfricaCallRecording: mocks.importRecording }));
import { POST } from "@/app/api/africastalking/voice/events/route";
const request = () => new Request("https://example.test/events?secret=test", { method: "POST", body: new URLSearchParams({ sessionId: "provider-1", destinationNumber: "+2348000000000", callerNumber: "+2348000000001", isActive: "0", callSessionState: "Completed", recordingUrl: "https://unapproved.example.test/private.wav" }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.updates = [];
  mocks.call = { id: "call-1", business_id: "business-1", status: "ringing", answered_at: null, recording_choice: "accepted", recording_consent_at: "2026-10-26T10:00:00Z" };
  mocks.from.mockImplementation(table => {
    const q: Record<string, unknown> = {};
    for (const key of ["select", "eq", "in", "order", "limit", "insert"]) q[key] = () => q;
    q.update = (value: Record<string, unknown>) => { if (table === "azera_calls") { mocks.updates.push(value); Object.assign(mocks.call, value); } return q; };
    q.maybeSingle = async () => ({ data: table === "azera_calls" ? mocks.call : null, error: null });
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return q;
  });
  mocks.importRecording.mockImplementation(async () => {
    expect(mocks.call.status).toBe("missed");
    expect(mocks.call.ended_at).toBeTruthy();
    throw new Error("Unapproved provider recording host");
  });
});
describe("Carrier completion survives recording import failure", () => {
  it("saves the terminal state before a recording error and preserves retryable diagnostics", async () => {
    expect((await POST(request())).status).toBe(503);
    expect(mocks.updates).toContainEqual(expect.objectContaining({ status: "missed", final_outcome: "missed" }));
    expect(mocks.finish).toHaveBeenCalledWith("event-1", "failed", "Unapproved provider recording host");
    expect(mocks.importRecording).toHaveBeenCalledOnce();
  });
  it("still marks an answered call ended before attempting recording import", async () => {
    mocks.call.status = "active"; mocks.call.answered_at = "2026-10-26T10:01:00Z";
    mocks.importRecording.mockImplementation(async () => { expect(mocks.call.status).toBe("ended"); throw new Error("Recording download failed"); });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.call.status).toBe("ended"); expect(mocks.call.ended_at).toBeTruthy();
  });
  it("never downloads a recording after a declined consent", async () => {
    mocks.call.recording_choice = "declined";
    expect((await POST(request())).status).toBe(200);
    expect(mocks.importRecording).not.toHaveBeenCalled(); expect(mocks.call.status).toBe("missed");
  });
});
