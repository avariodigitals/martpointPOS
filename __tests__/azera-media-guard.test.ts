import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/settings", () => ({ getSettings: vi.fn() }));
import { selfHostedMediaAllowed } from "@/lib/azera-media";
import { getIntegrationDefaults } from "@/lib/integrations";
const config = {
  ...getIntegrationDefaults().livekit,
  serverUrl: "https://media.example.test",
  publicUrl: "wss://media.example.test",
  apiKey: "test-key",
  apiSecret: "test-secret",
};
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("No paid media fallback", () => {
  it("is disabled without explicit self-hosted mode", () => {
    vi.stubEnv("AZERA_MEDIA_MODE", "");
    vi.stubEnv("AZERA_MEDIA_HOSTS", "media.example.test");
    expect(selfHostedMediaAllowed(config)).toBe(false);
  });
  it("accepts only explicitly approved self-hosted endpoints", () => {
    vi.stubEnv("AZERA_MEDIA_MODE", "self_hosted");
    vi.stubEnv("AZERA_MEDIA_HOSTS", "media.example.test");
    expect(selfHostedMediaAllowed(config)).toBe(true);
    expect(
      selfHostedMediaAllowed({
        ...config,
        publicUrl: "wss://another.example.test",
      }),
    ).toBe(false);
  });
  it("blocks LiveKit Cloud even if accidentally allowlisted", () => {
    vi.stubEnv("AZERA_MEDIA_MODE", "self_hosted");
    vi.stubEnv("AZERA_MEDIA_HOSTS", "demo.livekit.cloud");
    expect(
      selfHostedMediaAllowed({
        ...config,
        serverUrl: "https://demo.livekit.cloud",
        publicUrl: "wss://demo.livekit.cloud",
      }),
    ).toBe(false);
  });
  it("rejects insecure public hosts and embedded URL credentials", () => {
    vi.stubEnv("AZERA_MEDIA_MODE", "self_hosted");
    vi.stubEnv("AZERA_MEDIA_HOSTS", "media.example.test");
    expect(
      selfHostedMediaAllowed({
        ...config,
        serverUrl: "http://media.example.test",
      }),
    ).toBe(false);
    expect(
      selfHostedMediaAllowed({
        ...config,
        publicUrl: "wss://user:secret@media.example.test",
      }),
    ).toBe(false);
  });
});
