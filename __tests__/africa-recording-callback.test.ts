import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  config: vi.fn(),
  updates: [] as Record<string, unknown>[],
  call: {} as Record<string, unknown>,
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/africastalking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/africastalking")>();
  return {
    ...original,
    callbackSecretIsValid: () => true,
    resolveAfricaBusinessId: async () => "business-1",
    storeAfricaWebhookEvent: async () => "event-1",
    finishAfricaWebhookEvent: vi.fn(),
    getAfricaVoiceConfig: mocks.config,
  };
});
vi.mock("@/lib/africa-call-recording", () => ({
  importAfricaCallRecording: vi.fn(),
}));
import { POST } from "@/app/api/africastalking/voice/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.call = {
    id: "call-1",
    status: "ringing",
    menu_attempts: 0,
    selected_department: null,
    recording_choice: null,
    recording_consent_at: null,
  };
  mocks.config.mockResolvedValue({
    recordCalls: true,
    recordingNotice:
      "We would like to record. Press 1 to agree or press 2 to continue without recording.",
    recordingRetentionDays: 90,
    departments: [],
    timezone: "Africa/Lagos",
    weeklySchedule: { sun: [{ start: "00:00", end: "23:59" }] },
    closedDates: [],
    menuEnabled: false,
    forwardNumbers: ["+2348000000001"],
    phoneNumber: "+2348000000000",
    waitingAudioUrl: "",
    connectingGreeting: "Connecting you",
    greeting: "Hello",
    voicemailEnabled: false,
  });
  mocks.from.mockImplementation(() => {
    const q = {} as Record<string, unknown>;
    for (const name of ["select", "eq", "is", "in", "insert"])
      q[name] = vi.fn(() => q);
    q.update = vi.fn((value: Record<string, unknown>) => {
      mocks.updates.push(value);
      return q;
    });
    q.maybeSingle = vi.fn(async () => ({ data: mocks.call, error: null }));
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return q;
  });
});
const request = (digits: string) =>
  new Request(
    "https://example.test/callback?secret=test&stage=recording-consent",
    {
      method: "POST",
      body: new URLSearchParams({
        sessionId: "provider-1",
        callerNumber: "+2348000000002",
        destinationNumber: "+2348000000000",
        dtmfDigits: digits,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
describe("Recording choice callback", () => {
  it("records only an explicit press of 1", async () => {
    const text = await (await POST(request("1"))).text();
    expect(text).toContain('record="true"');
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        recording_choice: "accepted",
        recording_consent_at: expect.any(String),
      }),
    );
  });
  it.each(["2", "", "9"])(
    "continues without recording for input %s",
    async (digits) => {
      const text = await (await POST(request(digits))).text();
      expect(text).toContain("<Dial");
      expect(text).not.toContain('record="true"');
      expect(mocks.updates).toContainEqual(
        expect.objectContaining({
          recording_choice: "declined",
          recording_consent_at: null,
        }),
      );
    },
  );
  it("does not restart a terminal call on a replayed callback", async () => {
    mocks.call.status = "ended";
    expect(await (await POST(request("1"))).text()).not.toContain("<Dial");
    expect(mocks.updates).toEqual([]);
  });
});
