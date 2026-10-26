import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cloudflareSfuConfigured, cloudflareSfuEnabled, cloudflareTurnConfigured } from "@/lib/cloudflare-rtc";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in again to check website calling." }, { status: 401 });
  if (!hasPermission(session.role, "settings")) return NextResponse.json({ error: "Settings access is required to check website calling." }, { status: 403 });
  try {
  const schema = isSupabaseConfigured() ? await supabase.from("azera_cloudflare_participants").select("call_id,operation_claimed_at,ice_servers").limit(0) : { error: true };
  return NextResponse.json({ selected: process.env.AZERA_BROWSER_MEDIA === "cloudflare", appConfigured: cloudflareSfuConfigured(), turnConfigured: cloudflareTurnConfigured(), cleanupConfigured: Boolean(process.env.CRON_SECRET?.trim()), schemaReady: !schema.error, enabled: cloudflareSfuEnabled() && !schema.error, liveVerified: false, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Website calling configuration could not be checked. Please retry." }, { status: 503 });
  }
}
