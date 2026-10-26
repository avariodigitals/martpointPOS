import { describe, expect, it, vi } from "vitest";
const handler = vi.hoisted(() => vi.fn());
vi.mock("@/app/api/africastalking/voice/callback/route", () => ({ POST: handler }));
import { POST } from "@/app/api/africastalking/voice/consent/route";
describe("Dedicated recording-choice endpoint", () => {
  it("preserves provider POST data and authentication while setting the action explicitly", async () => {
    handler.mockImplementation(async request => {
      const url = new URL(request.url);
      expect(url.searchParams.get("secret")).toBe("test-only");
      expect(url.searchParams.get("stage")).toBe("recording-consent");
      expect(await request.text()).toBe("dtmfDigits=2&sessionId=provider-1");
      return new Response("<Response/>");
    });
    const response = await POST(new Request("https://example.test/api/africastalking/voice/consent?secret=test-only", { method: "POST", body: "dtmfDigits=2&sessionId=provider-1", headers: { "Content-Type": "application/x-www-form-urlencoded" } }));
    expect(await response.text()).toBe("<Response/>");
  });
  it("does not bypass callback authentication failures", async () => {
    handler.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect((await POST(new Request("https://example.test/api/africastalking/voice/consent", { method: "POST" }))).status).toBe(403);
  });
});
