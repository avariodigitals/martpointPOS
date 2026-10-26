import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ session: vi.fn(), allowed: true }));
vi.mock("@/lib/admin-auth", () => ({ getSession: auth.session, hasPermission: () => auth.allowed }));
import { GET } from "@/app/api/azera/calls/africa-browser/provider-urls/route";
afterEach(() => { vi.unstubAllEnvs(); auth.allowed = true; });
describe("Copy-ready provider callbacks", () => {
  it("builds absolute API URLs with encoded secrets, never /admin links", async () => {
    auth.session.mockResolvedValue({ role: "Admin" });
    vi.stubEnv("AFRICASTALKING_CALLBACK_SECRET", "test-secret&encoded"); vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://www.example.test/");
    const response = await GET(); const data = await response.json();
    expect(data.urls.callback).toBe("https://www.example.test/api/africastalking/voice/callback?secret=test-secret%26encoded");
    expect(data.urls.events).toContain("/api/africastalking/voice/events?");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not expose secret-bearing URLs to non-settings users", async () => {
    auth.session.mockResolvedValue({ role: "Sales" }); auth.allowed = false;
    expect((await GET()).status).toBe(403);
  });
  it("requires a configured callback secret", async () => {
    auth.session.mockResolvedValue({ role: "Admin" }); vi.stubEnv("AFRICASTALKING_CALLBACK_SECRET", "");
    expect((await GET()).status).toBe(503);
  });
});
