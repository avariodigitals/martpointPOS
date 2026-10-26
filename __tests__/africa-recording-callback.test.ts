import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  config: vi.fn(),
  updates: [] as Record<string, unknown>[],
  call: {} as Record<string, unknown>,
  open: true,
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
    isVoiceBusinessOpen: () => mocks.open,
  };
});
vi.mock("@/lib/africa-call-recording", () => ({
  importAfricaCallRecording: vi.fn(),
}));
import { POST } from "@/app/api/africastalking/voice/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.open = true;
  mocks.call = {
    id: "call-1",
    status: "ringing",
    menu_attempts: 0,
    selected_department: null,
    recording_choice: null,
    recording_consent_at: null,
    recording_consent_requested_at: null,
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
    afterHoursDestination: "+2348000000099",
  });
  mocks.from.mockImplementation((table) => {
    const q = {} as Record<string, unknown>;
    let update: Record<string, unknown> | null = null;
    const nullFilters: string[] = [];
    for (const name of ["select", "eq", "in", "insert"])
      q[name] = vi.fn(() => q);
    q.is = vi.fn((column: string) => { nullFilters.push(column); return q; });
    q.update = vi.fn((value: Record<string, unknown>) => {
      mocks.updates.push(value);
      update = value;
      return q;
    });
    const execute = () => {
      if (table === "azera_calls" && update) {
        if (nullFilters.some(column => mocks.call[column] != null)) return { data: null, error: null };
        Object.assign(mocks.call, update);
      }
      return { data: mocks.call, error: null };
    };
    q.maybeSingle = vi.fn(async () => execute());
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(table === "azera_calls" ? execute() : { data: [], error: null }).then(resolve);
    return q;
  });
});
const request = (digits: string, options: { defaultUrl?: boolean; timeout?: boolean; state?: string } = {}) =>
  new Request(
    `https://example.test/callback?secret=test${options.defaultUrl ? "" : "&stage=recording-consent"}${options.timeout ? "&consent-timeout=1" : ""}`,
    {
      method: "POST",
      body: new URLSearchParams({
        sessionId: "provider-1",
        callerNumber: "+2348000000002",
        destinationNumber: "+2348000000000",
        dtmfDigits: digits,
        ...(options.state ? { callSessionState: options.state } : {}),
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
  it.each(["1", "2"])("consumes after-hours consent %s on the default callback without repeating the prompt", async digit => {
    mocks.open = false;
    const first = await (await POST(request("", { defaultUrl: true }))).text();
    expect(first).toContain("<GetDigits");
    expect(first).toContain("/api/africastalking/voice/consent");
    expect(mocks.call.recording_consent_requested_at).toBeTruthy();
    const second = await (await POST(request(digit, { defaultUrl: true, state: "Active" }))).text();
    expect(second).toContain('phoneNumbers="+2348000000099"');
    expect(second).not.toContain("GetDigits");
    expect(second.includes('record="true"')).toBe(digit === "1");
  });
  it("keeps the selected department when the next press of 2 means no recording, not Support", async () => {
    const config = await mocks.config();
    config.menuEnabled = true;
    config.departments = [
      { digit: 1, key: "sales", label: "Sales", numbers: ["+2348000000011"] },
      { digit: 2, key: "support", label: "Support", numbers: ["+2348000000022"] },
    ];
    expect(await (await POST(request("1", { defaultUrl: true }))).text()).toContain("GetDigits");
    const second = await (await POST(request("2", { defaultUrl: true }))).text();
    expect(second).toContain('phoneNumbers="+2348000000011"');
    expect(second).not.toContain("+2348000000022");
    expect(second).not.toContain('record="true"');
    expect(second).not.toContain("GetDigits");
  });
  it("never treats a department digit carried into a timeout redirect as recording consent", async () => {
    mocks.call.selected_department = "default";
    mocks.call.recording_consent_requested_at = new Date().toISOString();
    const xml = await (await POST(request("1", { timeout: true }))).text();
    expect(xml).toContain('phoneNumbers="+2348000000001"');
    expect(xml).not.toContain('record="true"');
    expect(mocks.call.recording_choice).toBe("declined");
  });
  it("preserves a previously stored decline if a later callback contains 1", async () => {
    mocks.call.recording_choice = "declined";
    mocks.call.recording_consent_requested_at = new Date().toISOString();
    expect(await (await POST(request("1", { defaultUrl: true }))).text()).not.toContain('record="true"');
    expect(mocks.call.recording_choice).toBe("declined");
  });
  it("does not replay the consent prompt forever on empty callbacks", async () => {
    mocks.call.recording_consent_requested_at = new Date(Date.now()-20_000).toISOString();
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml).toContain("<Dial"); expect(xml).not.toContain("GetDigits"); expect(xml).not.toContain('record="true"');
  });
  it("does not redial an active call on a delayed consent response", async () => {
    mocks.call.status = "active";
    expect(await (await POST(request("1"))).text()).not.toContain("<Dial");
  });
});
