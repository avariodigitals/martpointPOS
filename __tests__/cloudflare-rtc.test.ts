import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioSdp, cloudflareIceServers, cloudflareSfuEnabled, closeSfuSession, sfuRequest } from "@/lib/cloudflare-rtc";
const audio = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\n";
beforeEach(() => {
  vi.stubEnv("AZERA_BROWSER_MEDIA", "cloudflare"); vi.stubEnv("CLOUDFLARE_REALTIME_APP_ID", "app_test"); vi.stubEnv("CLOUDFLARE_REALTIME_APP_SECRET", "private-app-secret");
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "turn_test"); vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "private-turn-secret"); vi.stubEnv("CRON_SECRET", "private-cron-secret");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Cloudflare media adapter", () => {
  it("requires explicit selection, both credentials and scheduled cleanup", () => {
    expect(cloudflareSfuEnabled()).toBe(true);
    vi.stubEnv("AZERA_BROWSER_MEDIA", ""); expect(cloudflareSfuEnabled()).toBe(false);
    vi.stubEnv("AZERA_BROWSER_MEDIA", "cloudflare"); vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", ""); expect(cloudflareSfuEnabled()).toBe(false);
  });
  it("keeps SFU secrets on the server and uses only the fixed provider origin", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ sessionId: "s_test" }));
    await sfuRequest(null, "new");
    expect(fetch).toHaveBeenCalledWith("https://rtc.live.cloudflare.com/v1/apps/app_test/sessions/new", expect.objectContaining({ method: "POST", redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer private-app-secret" }) }));
    await expect(sfuRequest("../other", "inspect")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects HTTP and per-track failures without returning provider details", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ secret: "account-info" }, { status: 403 }));
    await expect(sfuRequest(null, "new")).rejects.toThrow("temporarily unavailable");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tracks: [{ errorCode: "unavailable" }] }));
    await expect(sfuRequest("session_1", "publish", {})).rejects.toThrow("could not complete");
  });
  it("inspects and force-closes all allocated tracks, including a lost allocation response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tracks: [{ mid: "0", status: "active" }, { mid: "1", status: "inactive" }] })).mockResolvedValueOnce(Response.json({ tracks: [{ mid: "0" }] }));
    await closeSfuSession("session_1");
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toEqual({ tracks: [{ mid: "0" }], force: true });
  });
  it("requests bounded TURN credentials and strips browser-blocked ports", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }, { urls: ["turn:turn.cloudflare.com:53?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "temporary-user", credential: "temporary-password" }] }));
    const ice = await cloudflareIceServers();
    expect(ice).toHaveLength(2);
    expect(ice[1].urls).toEqual(["turns:turn.cloudflare.com:443?transport=tcp"]);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ ttl: 2400 });
    expect(JSON.stringify(ice)).not.toContain("private-turn-secret");
  });
  it("accepts only a single audio media section with the expected SDP type", () => {
    expect(audioSdp({ type: "offer", sdp: audio }, "offer")).toBe(true);
    expect(audioSdp({ type: "answer", sdp: audio }, "offer")).toBe(false);
    expect(audioSdp({ type: "offer", sdp: audio + "m=video 9 RTP/SAVPF 96\r\n" }, "offer")).toBe(false);
    expect(audioSdp({ type: "offer", sdp: audio + "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n" }, "offer")).toBe(false);
  });
  it("accepts explicit expired sessions and already-closed tracks as cleanup, but not missing acknowledgements", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ errorCode: "session_error" }, { status: 410 }));
    await expect(closeSfuSession("expired_1")).resolves.toBeUndefined();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tracks: [{ mid: "0" }] })).mockResolvedValueOnce(Response.json({ tracks: [{ mid: "0", errorCode: "close_track_error" }] }));
    await expect(closeSfuSession("closed_1")).resolves.toBeUndefined();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tracks: [{ mid: "0" }] })).mockResolvedValueOnce(Response.json({ tracks: [] }));
    await expect(closeSfuSession("unconfirmed_1")).rejects.toThrow("not fully confirmed");
  });
});
