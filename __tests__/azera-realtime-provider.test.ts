import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ provider: vi.fn() }));
vi.mock("@/lib/ai-voice", () => ({ getAiVoiceProvider: mocks.provider }));
import {
  createRealtimeCall,
  hangupRealtimeCall,
  voiceInstructions,
  realtimeVoiceEnabled,
} from "@/lib/azera-realtime";
const provider = {
  apiKey: "server-only-key",
  baseUrl: "https://api.openai.com/v1",
};
beforeEach(() => {
  mocks.provider.mockResolvedValue(provider);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Direct Realtime voice", () => {
  it("stays disabled until the deployment switch and authenticated cron are configured", () => {
    vi.stubEnv("AZERA_REALTIME_ENABLED", "");
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(realtimeVoiceEnabled()).toBe(false);
    vi.stubEnv("AZERA_REALTIME_ENABLED", "true");
    vi.stubEnv("CRON_SECRET", "");
    expect(realtimeVoiceEnabled()).toBe(false);
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(realtimeVoiceEnabled()).toBe(true);
  });
  it("keeps the provider key on the server and submits a bounded voice session", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("v=0\r\nanswer", {
        headers: { location: "/v1/realtime/calls/rtc_test" },
      }),
    );
    expect(
      await createRealtimeCall(
        "v=0\r\noffer",
        "Trusted instructions",
        "hashed-id",
      ),
    ).toEqual({ providerId: "rtc_test", answer: "v=0\r\nanswer" });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer server-only-key",
      "OpenAI-Safety-Identifier": "hashed-id",
    });
    const config = JSON.parse(
      (options?.body as FormData).get("session") as string,
    );
    expect(config).toMatchObject({
      type: "realtime",
      max_output_tokens: 512,
      instructions: "Trusted instructions",
      tools: [{ name: "request_human" }],
    });
    expect(config.audio.input.turn_detection.interrupt_response).toBe(true);
    expect(JSON.stringify(config)).not.toContain(provider.apiKey);
  });
  it("does not send an OpenAI key to an arbitrary compatible provider", async () => {
    mocks.provider.mockResolvedValue({
      ...provider,
      baseUrl: "https://other.example.test/v1",
    });
    await expect(createRealtimeCall("v=0", "hello", "id")).rejects.toThrow(
      "not configured",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses malformed provider locations instead of using them for follow-up requests", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("v=0", {
        headers: {
          location: "https://attacker.test/v1/realtime/calls/rtc_test",
        },
      }),
    );
    await expect(createRealtimeCall("v=0", "hello", "id")).rejects.toThrow(
      "could not connect",
    );
  });
  it("treats an already-ended provider session as closed, without arbitrary URL fetching", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await hangupRealtimeCall("rtc_test");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls/rtc_test/hangup",
      expect.objectContaining({ method: "POST" }),
    );
    vi.mocked(fetch).mockClear();
    await expect(hangupRealtimeCall("../../other")).rejects.toThrow("Invalid");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds public knowledge and explicitly forbids private account disclosures and fake handoffs", () => {
    const prompt = voiceInstructions("x".repeat(20_000), [
      { title: "Retail", content: "<p>" + "y".repeat(50_000) + "</p>" },
    ]);
    expect(prompt).not.toContain("<p>");
    expect(prompt.length).toBeLessThan(26_000);
    expect(prompt).toContain("Public callers are unverified");
    expect(prompt).toContain("do not claim a transfer is complete");
  });
});
