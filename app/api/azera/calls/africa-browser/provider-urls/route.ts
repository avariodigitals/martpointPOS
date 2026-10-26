import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";

/** Secret-bearing URLs are disclosed only on an explicit settings-user request. */
export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "settings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const secret = process.env.AFRICASTALKING_CALLBACK_SECRET;
  if (!secret) return NextResponse.json({ error: "Set AFRICASTALKING_CALLBACK_SECRET in Vercel before configuring these URLs." }, { status: 503 });
  let origin = "https://www.martpoint.com.ng";
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || origin);
    if (configured.protocol === "https:") origin = configured.origin;
  } catch { /* Keep the canonical production origin. */ }
  const urls = Object.fromEntries(["callback", "events", "recording"].map(kind => {
    const url = new URL(`/api/africastalking/voice/${kind}`, origin);
    url.searchParams.set("secret", secret);
    return [kind, url.toString()];
  }));
  return NextResponse.json({ urls }, { headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } });
}
