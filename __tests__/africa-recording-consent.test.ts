import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
  isSupabaseConfigured: () => false,
}));
vi.mock("@/lib/settings", () => ({ getSettings: vi.fn() }));
import {
  recordingConsentAction,
  recordedDialAction,
} from "@/lib/africa-recording-actions";
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("Africa’s Talking recording consent", () => {
  it("uses an explicit digit choice and preserves callback authentication", () => {
    const xml = recordingConsentAction(
      "https://app.test/callback?secret=test",
      "Press 1 to agree & 2 to decline",
    );
    expect(xml).toContain("stage=recording-consent");
    expect(xml).toContain("secret=test&amp;");
    expect(xml).toContain("Press 1 to agree &amp; 2 to decline");
  });
  it("never records a default dial and uses only documented recording attributes when consented", () => {
    expect(recordedDialAction(["+2348000000001"], "", "", false)).not.toContain(
      'record="true"',
    );
    expect(recordedDialAction(["+2348000000001"], "", "", true)).toContain(
      'record="true"',
    );
    expect(recordedDialAction(["+2348000000001"], "", "", true)).not.toContain(
      "callbackUrl",
    );
  });
  it("refuses an automatic import without explicit recorded consent", async () => {
    await expect(
      importAfricaCallRecording(
        {
          id: "call",
          business_id: "business",
          recording_choice: "declined",
          recording_consent_at: null,
        },
        "https://africastalking.com/audio.mp3",
        "recording",
        90,
      ),
    ).rejects.toThrow("No recording consent");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
