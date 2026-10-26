import { POST as handleVoice } from "@/app/api/africastalking/voice/callback/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A distinct path retains the action even if a provider/proxy loses stage.
 * Authentication still runs in the shared handler; no public bypass. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("stage", "recording-consent");
  return handleVoice(new Request(url, request));
}
