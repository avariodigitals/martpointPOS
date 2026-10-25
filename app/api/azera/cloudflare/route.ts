import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cloudflareSfuConfigured, cloudflareSfuEnabled, cloudflareTurnConfigured } from "@/lib/cloudflare-rtc";
export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "azera")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schema = isSupabaseConfigured() ? await supabase.from("azera_cloudflare_participants").select("call_id,operation_claimed_at,ice_servers").limit(0) : { error: true };
  return NextResponse.json({ selected: process.env.AZERA_BROWSER_MEDIA === "cloudflare", appConfigured: cloudflareSfuConfigured(), turnConfigured: cloudflareTurnConfigured(), cleanupConfigured: Boolean(process.env.CRON_SECRET), schemaReady: !schema.error, enabled: cloudflareSfuEnabled() && !schema.error, liveVerified: false }, { headers: { "Cache-Control": "no-store" } });
}
