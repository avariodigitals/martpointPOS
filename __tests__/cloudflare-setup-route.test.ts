import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), permission: vi.fn(), from: vi.fn(), schemaError: null as null | object, throws: false }));
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: mocks.permission }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }));
import { GET } from "@/app/api/azera/cloudflare/route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.schemaError = null; mocks.throws = false;
  mocks.session.mockResolvedValue({ role: "Tech" }); mocks.permission.mockImplementation((_role, permission) => permission === "settings");
  mocks.from.mockImplementation(() => ({ select: () => ({ limit: async () => { if (mocks.throws) throw new Error("private database details"); return { error: mocks.schemaError }; } }) }));
  vi.stubEnv("AZERA_BROWSER_MEDIA", "cloudflare"); vi.stubEnv("CLOUDFLARE_REALTIME_APP_ID", "test_app"); vi.stubEnv("CLOUDFLARE_REALTIME_APP_SECRET", "test-app-secret");
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "test_turn"); vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "test-turn-secret"); vi.stubEnv("CRON_SECRET", "test-cron-secret");
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("Cloudflare settings status API", () => {
  it("uses the parent Settings permission, including Tech, and does not expose keys", async () => {
    const response = await GET(); const body = await response.json();
    expect(response.status).toBe(200); expect(body.enabled).toBe(true); expect(body.liveVerified).toBe(false);
    expect(mocks.permission).toHaveBeenCalledWith("Tech", "settings");
    expect(Date.parse(body.checkedAt)).not.toBeNaN();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(JSON.stringify(body)).not.toContain("test-app-secret"); expect(JSON.stringify(body)).not.toContain("test-turn-secret"); expect(JSON.stringify(body)).not.toContain("test-cron-secret");
  });
  it("distinguishes an expired session from insufficient permission", async () => {
    mocks.session.mockResolvedValue(null); expect((await GET()).status).toBe(401);
    mocks.session.mockResolvedValue({ role: "Sales" }); mocks.permission.mockReturnValue(false); expect((await GET()).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not report ready with missing schema or cleanup configuration", async () => {
    mocks.schemaError = { message: "migration missing" };
    expect(await (await GET()).json()).toMatchObject({ schemaReady: false, enabled: false });
    mocks.schemaError = null; vi.stubEnv("CRON_SECRET", "   ");
    expect(await (await GET()).json()).toMatchObject({ cleanupConfigured: false, enabled: false });
  });
  it("reports server failures safely without disclosing internals", async () => {
    mocks.throws = true;
    const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private database details");
  });
});
