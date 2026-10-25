import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  inserted: [] as Record<string, unknown>[],
  existing: null as null | { id: string },
  saveError: null as null | { code: string },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  },
}));
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
const call = {
  id: "call-1",
  business_id: "business-1",
  recording_choice: "accepted",
  recording_consent_at: "2026-10-25T08:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.existing = null;
  mocks.saveError = null;
  mocks.inserted = [];
  vi.stubEnv("AFRICASTALKING_RECORDING_HOSTS", "africastalking.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "audio/mpeg" },
        }),
    ),
  );
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.from.mockImplementation(() => {
    const q = {} as Record<string, unknown>;
    for (const key of ["select", "eq"]) q[key] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: mocks.existing, error: null }));
    q.insert = vi.fn((row: Record<string, unknown>) => {
      mocks.inserted.push(row);
      return q;
    });
    q.single = vi.fn(async () => ({
      data: { id: "recording-1" },
      error: mocks.saveError,
    }));
    return q;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Private automatic call-recording import", () => {
  it("stores provider audio privately with consent and never exposes the provider URL", async () => {
    expect(
      await importAfricaCallRecording(
        call,
        "https://voice.africastalking.com/record.mp3",
        "reference-1",
        90,
      ),
    ).toBe("recording-1");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: "error" }),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^business-1\/call-1\/.+\.mp3$/),
      expect.any(Buffer),
      expect.objectContaining({ upsert: false }),
    );
    expect(mocks.inserted[0]).toMatchObject({
      recording_url: "",
      recording_type: "auto",
      provider_reference: "reference-1",
      consent_confirmed_at: call.recording_consent_at,
      file_size_bytes: 3,
    });
  });
  it("treats an already imported provider reference as idempotent", async () => {
    mocks.existing = { id: "already-saved" };
    expect(
      await importAfricaCallRecording(
        call,
        "https://voice.africastalking.com/record.mp3",
        "reference-1",
        90,
      ),
    ).toBe("already-saved");
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each([
    "http://voice.africastalking.com/record.mp3",
    "https://127.0.0.1/private",
    "https://africastalking.com.attacker.test/record.mp3",
    "https://user:password@voice.africastalking.com/record.mp3",
  ])("rejects unapproved recording URL %s before fetching", async (url) => {
    await expect(
      importAfricaCallRecording(call, url, "reference-1", 90),
    ).rejects.toThrow("Unapproved");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("removes only the newly uploaded file if recording-history persistence fails", async () => {
    mocks.saveError = { code: "database-error" };
    await expect(
      importAfricaCallRecording(
        call,
        "https://voice.africastalking.com/record.mp3",
        "reference-1",
        90,
      ),
    ).rejects.toThrow("history");
    expect(mocks.remove).toHaveBeenCalledWith([
      mocks.inserted[0].recording_path,
    ]);
  });
  it("rejects oversized provider responses instead of silently storing a broken reference", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("audio", {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(26 * 1024 * 1024),
        },
      }),
    );
    await expect(
      importAfricaCallRecording(
        call,
        "https://voice.africastalking.com/record.mp3",
        "reference-1",
        90,
      ),
    ).rejects.toThrow("could not be downloaded");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.inserted).toEqual([]);
  });
});
