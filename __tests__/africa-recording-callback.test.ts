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
    greetingAudioUrl: "",
    connectingAudioUrl: "",
    afterHoursGreeting: "Our office is closed",
    afterHoursAudioUrl: "",
    noAnswerGreeting: "Please try again later",
    menuRetryLimit: 1,
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
const request = (digits: string, options: { defaultUrl?: boolean; timeout?: boolean; state?: string; menuAttempt?: number; menuTimeout?: boolean } = {}) =>
  new Request(
    `https://example.test/callback?secret=test${options.menuAttempt !== undefined ? `&stage=department-menu&menu-attempt=${options.menuAttempt}${options.menuTimeout ? "&menu-timeout=1" : ""}` : options.defaultUrl ? "" : "&stage=recording-consent"}${options.timeout ? "&consent-timeout=1" : ""}`,
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

describe("Working-hours greeting and menu journey", () => {
  async function enableMenu(retries = 1) {
    const config = await mocks.config();
    config.recordCalls = false;
    config.greeting = "Welcome to MartPoint.";
    config.menuEnabled = true;
    config.menuRetryLimit = retries;
    config.departments = [
      { digit: 1, key: "sales", label: "Sales", numbers: ["+2348000000011"] },
      { digit: 2, key: "support", label: "Support", numbers: ["+2348000000022"] },
    ];
    return config;
  }
  it.each(["1", "2"])("runs welcome, consent %s, department and dial as distinct steps", async digit => {
    const config = await enableMenu(); config.recordCalls = true;
    config.greeting = "Welcome to MartPoint.\n\nFor sales or demos, press 1.\nFor support, press 2.";
    const welcome = await (await POST(request("", { defaultUrl: true }))).text();
    expect(welcome.indexOf("Welcome to MartPoint.")).toBeLessThan(welcome.indexOf("We would like to record"));
    expect(welcome).not.toContain("For sales"); expect(welcome).not.toContain("<Dial");
    expect(mocks.call.selected_department).toBe("__department_menu__");
    const menu = await (await POST(request(digit))).text();
    expect(menu).toContain("For sales or demos, press 1."); expect(menu).not.toContain("Welcome");
    expect(menu).not.toContain("We would like to record"); expect(menu).not.toContain("<Dial");
    expect(mocks.call.selected_department).toBeNull(); expect(mocks.call.menu_attempts).toBe(1);
    const connected = await (await POST(request("2", { menuAttempt: 1 }))).text();
    expect(connected).toContain('phoneNumbers="+2348000000022"');
    expect(connected).not.toContain("GetDigits"); expect(connected).not.toContain("Welcome");
    expect(connected.includes('record="true"')).toBe(digit === "1");
  });
  it("consent timeout still opens the menu without recording or consuming a carried digit", async () => {
    const config = await enableMenu(); config.recordCalls = true;
    await POST(request("", { defaultUrl: true }));
    const menu = await (await POST(request("1", { timeout: true }))).text();
    expect(menu).toContain("stage=department-menu"); expect(menu).not.toContain("<Dial");
    expect(mocks.call.recording_choice).toBe("declined");
    const connected = await (await POST(request("1", { menuAttempt: 1 }))).text();
    expect(connected).toContain('phoneNumbers="+2348000000011"'); expect(connected).not.toContain('record="true"');
  });
  it("does not use a duplicate consent response as a department or reset menu attempts", async () => {
    const config = await enableMenu(); config.recordCalls = true;
    await POST(request("", { defaultUrl: true })); await POST(request("2"));
    mocks.call.menu_attempts = 2;
    const replay = await (await POST(request("1"))).text();
    expect(replay).toContain("menu-attempt=2"); expect(replay).not.toContain("<Dial");
    expect(mocks.call.recording_choice).toBe("declined"); expect(mocks.call.selected_department).toBeNull();
  });
  it("finishes the same menu journey if closing time passes during consent", async () => {
    const config = await enableMenu(); config.recordCalls = true;
    await POST(request("", { defaultUrl: true })); mocks.open = false;
    expect(await (await POST(request("2"))).text()).toContain("stage=department-menu");
    const connected = await (await POST(request("1", { menuAttempt: 1 }))).text();
    expect(connected).toContain('phoneNumbers="+2348000000011"'); expect(connected).not.toContain("Our office is closed");
  });
  it("welcomes first-time callers without claiming they already missed a selection", async () => {
    await enableMenu();
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml).toContain("Welcome to MartPoint.");
    expect(xml).toContain("Press 1 for Sales.");
    expect(xml).toContain("stage=department-menu");
    expect(xml).toContain("menu-attempt=1");
    expect(xml).toContain("menu-timeout=1");
    expect(xml).toContain("<Redirect>");
    expect(xml).not.toContain("We did not receive");
    expect(xml).not.toContain("not a valid selection");
    expect(mocks.call.menu_attempts).toBe(1);
  });
  it("replays a retried initial delivery without counting it as a failed input", async () => {
    await enableMenu();
    await POST(request("", { defaultUrl: true }));
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml).not.toContain("We did not receive");
    expect(mocks.call.menu_attempts).toBe(1);
  });
  it("announces missing input only after a real timeout and then stops at the retry limit", async () => {
    await enableMenu();
    await POST(request("", { defaultUrl: true }));
    const retry = await (await POST(request("", { menuAttempt: 1, menuTimeout: true }))).text();
    expect(retry).toContain("We did not receive a selection.");
    expect(retry).toContain("menu-attempt=2");
    const fallback = await (await POST(request("", { menuAttempt: 2, menuTimeout: true }))).text();
    expect(fallback).not.toContain("GetDigits");
    expect(fallback).toContain('phoneNumbers="+2348000000001"');
  });
  it("honours zero retries without skipping the initial welcome", async () => {
    await enableMenu(0);
    expect(await (await POST(request("", { defaultUrl: true }))).text()).toContain("Welcome to MartPoint.");
    const xml = await (await POST(request("", { menuAttempt: 1, menuTimeout: true }))).text();
    expect(xml).toContain("<Dial"); expect(xml).not.toContain("GetDigits");
  });
  it("keeps the invalid-input explanation even when a custom menu audio file is configured", async () => {
    const config = await enableMenu(); config.greetingAudioUrl = "https://audio.example.test/welcome.mp3";
    await POST(request("", { defaultUrl: true }));
    const xml = await (await POST(request("6", { menuAttempt: 1 }))).text();
    expect(xml.indexOf("not a valid selection")).toBeLessThan(xml.indexOf("<GetDigits"));
    expect(xml).toContain('url="https://audio.example.test/welcome.mp3"');
  });
  it("does not replay the initial welcome as an error for repeat-menu key 9", async () => {
    await enableMenu(); await POST(request("", { defaultUrl: true }));
    const xml = await (await POST(request("9", { menuAttempt: 1 }))).text();
    expect(xml).toContain("Welcome to MartPoint.");
    expect(xml).not.toContain("We did not receive"); expect(xml).not.toContain("not a valid selection");
  });
  it("ignores stale menu callbacks rather than changing a newer prompt or recording choice", async () => {
    await enableMenu(); mocks.call.menu_attempts = 2;
    const stale = await (await POST(request("1", { menuAttempt: 1 }))).text();
    expect(stale).not.toContain("<Dial"); expect(mocks.updates).toEqual([]);
    mocks.call.selected_department = "sales"; mocks.call.recording_consent_requested_at = new Date().toISOString();
    expect(await (await POST(request("1", { menuAttempt: 2 }))).text()).not.toContain("<Dial");
    expect(mocks.call.recording_choice).toBeNull();
  });
  it("does not change to after-hours mid-menu if the clock crosses closing time", async () => {
    await enableMenu(); await POST(request("", { defaultUrl: true })); mocks.open = false;
    const xml = await (await POST(request("2", { menuAttempt: 1 }))).text();
    expect(xml).toContain('phoneNumbers="+2348000000022"'); expect(xml).not.toContain("Our office is closed");
  });
  it("does not confuse an old carried digit in a timeout Redirect with a department selection", async () => {
    await enableMenu(); await POST(request("", { defaultUrl: true }));
    const xml = await (await POST(request("1", { menuAttempt: 1, menuTimeout: true }))).text();
    expect(xml).toContain("We did not receive"); expect(xml).not.toContain("<Dial");
  });
  it("plays the main greeting before recording consent on a direct working-hours route", async () => {
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml.indexOf("<Say>Hello</Say>")).toBeLessThan(xml.indexOf("We would like to record"));
    const connected = await (await POST(request("2"))).text();
    expect(connected).toContain("Connecting you"); expect(connected).not.toContain("Hello");
  });
  it("does not repeat a legacy welcome embedded in the recording notice", async () => {
    const config = await enableMenu(); config.recordCalls = true;
    config.recordingNotice = "Welcome to MartPoint. Thank you for calling. We would like to record. Press 1 to agree or press 2 to continue without recording.";
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml.match(/Welcome to MartPoint/g)).toHaveLength(1);
    expect(xml).toContain("We would like to record."); expect(xml).toContain("press 2");
  });
  it("plays the after-hours greeting before recording consent without the working-hours menu", async () => {
    mocks.open = false;
    const xml = await (await POST(request("", { defaultUrl: true }))).text();
    expect(xml.indexOf("Our office is closed")).toBeLessThan(xml.indexOf("We would like to record"));
    expect(xml).not.toContain("Hello");
  });
  it("offers recording consent on the menu fallback instead of silently skipping the choice", async () => {
    const config = await enableMenu(0); config.recordCalls = true;
    // A live call may already be in the pre-deployment menu-first journey.
    mocks.call.menu_attempts = 1;
    const xml = await (await POST(request("", { menuAttempt: 1, menuTimeout: true }))).text();
    expect(xml).toContain("/voice/consent"); expect(xml).not.toContain("<Dial");
    expect(xml).not.toContain("stage=department-menu"); expect(xml).not.toContain("menu-timeout=");
    expect(mocks.call.selected_department).toBe("default");
  });
  it("does not ask for consent again when the new menu times out into its default route", async () => {
    const config = await enableMenu(0); config.recordCalls = true;
    await POST(request("", { defaultUrl: true })); await POST(request("2"));
    const xml = await (await POST(request("", { menuAttempt: 1, menuTimeout: true }))).text();
    expect(xml).toContain('phoneNumbers="+2348000000001"'); expect(xml).not.toContain("GetDigits");
    expect(xml).not.toContain('record="true"');
  });
});
