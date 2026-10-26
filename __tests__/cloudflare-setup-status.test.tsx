import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fetchCloudflareSetupStatus, CLOUDFLARE_SETUP_CHECKS } from "@/lib/cloudflare-setup-status";
import { CloudflareMediaSettings } from "@/components/admin/cloudflare-media-settings";
const status = { selected: false, appConfigured: true, turnConfigured: false, cleanupConfigured: true, schemaReady: true, enabled: false, liveVerified: false, checkedAt: "2026-10-26T10:00:00Z" };
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });
describe("Cloudflare setup refresh", () => {
  it("makes a new uncached request every time and returns the new check result", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(status)).mockResolvedValueOnce(Response.json({ ...status, turnConfigured: true, selected: true, enabled: true, checkedAt: "2026-10-26T10:01:00Z" }));
    const signal = new AbortController().signal;
    expect((await fetchCloudflareSetupStatus(signal)).enabled).toBe(false);
    expect((await fetchCloudflareSetupStatus(signal)).enabled).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith("/api/azera/cloudflare", { cache: "no-store", signal });
  });
  it.each([[401, "session has expired"], [403, "Settings access"], [503, "could not be checked"]])("explains an HTTP %s failure instead of silently leaving the old result", async (code, message) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: "do not relay provider secrets" }, { status: code as number }));
    await expect(fetchCloudflareSetupStatus(new AbortController().signal)).rejects.toThrow(message as string);
  });
  it("rejects malformed successful responses", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ enabled: true }));
    await expect(fetchCloudflareSetupStatus(new AbortController().signal)).rejects.toThrow("invalid response");
  });
  it("shows an initial checking state and distinguishes setup refresh from activation or AI settings", () => {
    const html = renderToStaticMarkup(<CloudflareMediaSettings />);
    expect(html).toContain("Checking setup…");
    expect(html).toContain("disabled");
    expect(html).toContain("not an AI setting");
    expect(html).toContain("Refresh does not save settings");
    expect(html).toContain("After changing environment variables, redeploy first");
    expect(html).not.toContain("AbortSignal.timeout");
  });
  it("provides an actionable instruction for each missing configuration check", () => {
    expect(CLOUDFLARE_SETUP_CHECKS).toHaveLength(5);
    expect(CLOUDFLARE_SETUP_CHECKS.every(check => check.action.length > 30)).toBe(true);
    expect(CLOUDFLARE_SETUP_CHECKS.find(check => check.key === "cleanupConfigured")!.action).toContain("not the running schedule");
  });
});
