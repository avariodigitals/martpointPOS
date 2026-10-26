/** Server-only Cloudflare Realtime SFU/TURN adapter. Never imported by clients. */
const origin = "https://rtc.live.cloudflare.com/v1";
const identifier = /^[A-Za-z0-9_-]{1,200}$/;
export function cloudflareSfuConfigured() {
  return Boolean(identifier.test(process.env.CLOUDFLARE_REALTIME_APP_ID || "") && process.env.CLOUDFLARE_REALTIME_APP_SECRET?.trim());
}
export function cloudflareSfuEnabled() {
  return process.env.AZERA_BROWSER_MEDIA === "cloudflare" && cloudflareSfuConfigured() && cloudflareTurnConfigured() && Boolean(process.env.CRON_SECRET?.trim());
}
export function cloudflareTurnConfigured() {
  return Boolean(identifier.test(process.env.CLOUDFLARE_TURN_KEY_ID || "") && process.env.CLOUDFLARE_TURN_API_TOKEN?.trim());
}
export type SfuResult = {
  sessionId?: string;
  sessionDescription?: { type: "offer" | "answer"; sdp: string };
  tracks?: { mid?: string; trackName?: string; errorCode?: string; status?: string }[];
  errorCode?: string;
  sessionExpired?: boolean;
};
async function providerRequest(path: string, secret: string, method: string, body?: object, closing = false, inspecting = false): Promise<SfuResult> {
  const response = await fetch(`${origin}${path}`, {
    method, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
  });
  // Never relay provider bodies, secrets or account details into public errors.
  const result = await response.json();
  if ((closing || inspecting) && response.status === 410 && result.errorCode === "session_error") return { tracks: [], sessionExpired: true };
  if (!response.ok) throw new Error("The audio service is temporarily unavailable. Please continue in chat.");
  if (result.errorCode || result.tracks?.some((track: { errorCode?: string }) => track.errorCode && !(closing && track.errorCode === "close_track_error")))
    throw new Error("The audio service could not complete this connection.");
  return result;
}
export async function sfuRequest(session: string | null, operation: "new" | "publish" | "subscribe" | "answer" | "inspect" | "close", body?: object) {
  if (!cloudflareSfuConfigured() || (session !== null && !identifier.test(session))) throw new Error("Cloudflare media is not configured");
  const path = `/apps/${process.env.CLOUDFLARE_REALTIME_APP_ID}/sessions`;
  const suffix = operation === "new" ? "/new" : `/${session}${operation === "inspect" ? "" : operation === "answer" ? "/renegotiate" : operation === "close" ? "/tracks/close" : "/tracks/new"}`;
  return providerRequest(path + suffix, process.env.CLOUDFLARE_REALTIME_APP_SECRET!, operation === "inspect" ? "GET" : ["answer", "close"].includes(operation) ? "PUT" : "POST", body, operation === "close", operation === "inspect");
}
export async function closeSfuSession(session: string) {
  // Inspect even after a lost tracks/new response: persisted session IDs make
  // allocation cleanup possible without trusting a browser-supplied track ID.
  const state = await sfuRequest(session, "inspect");
  const tracks = (state.tracks || []).filter((track) => track.mid && track.status !== "inactive").map((track) => ({ mid: track.mid }));
  if (tracks.length) {
    const result = await sfuRequest(session, "close", { tracks, force: true });
    if (!result.sessionExpired && tracks.some((track) => !result.tracks?.some((closed) => closed.mid === track.mid))) throw new Error("Audio shutdown was not fully confirmed");
  }
}
export async function cloudflareIceServers(): Promise<RTCIceServer[]> {
  const fallback = [{ urls: "stun:stun.cloudflare.com:3478" }];
  if (!cloudflareTurnConfigured()) return fallback;
  const response = await fetch(`${origin}/turn/keys/${process.env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: 2400 }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("The secure audio relay is temporarily unavailable.");
  const { iceServers } = await response.json();
  if (!Array.isArray(iceServers)) throw new Error("Invalid audio relay response");
  const result: RTCIceServer[] = iceServers.map((server: RTCIceServer) => ({
    urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url) => /^(stun|turn|turns):[\w.-]+:(3478|443|5349|80)(\?transport=(udp|tcp))?$/.test(url)),
    ...(server.username && server.credential ? { username: server.username, credential: server.credential } : {}),
  })).filter((server) => (server.urls as string[]).length);
  if (!result.some((server) => server.credential)) throw new Error("Invalid audio relay credentials");
  return result;
}
export function audioSdp(value: unknown, type: "offer" | "answer") {
  if (!value || typeof value !== "object") return false;
  const description = value as { type?: string; sdp?: string };
  return description.type === type && typeof description.sdp === "string" && description.sdp.length <= 65_536 && description.sdp.startsWith("v=0") &&
    (description.sdp.match(/^m=audio /gm) || []).length === 1 && !/^m=(?!audio )/m.test(description.sdp);
}
