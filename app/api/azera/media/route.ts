import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { selfHostedMediaAllowed } from "@/lib/azera-media";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { livekit } = await getSettings();
  const supervisor = session.role === "Admin";
  let query = supabase
    .from("azera_calls")
    .select(
      "id,customer_name,agent_name,agent_user_id,status,transfer_to_user_id,transfer_expires_at,held_at,started_at",
    )
    .eq("sip_provider", "livekit")
    .in("status", ["ringing", "active"])
    .order("started_at", { ascending: false })
    .limit(100);
  if (!supervisor)
    query = query.or(
      `agent_user_id.eq.${session.userId},transfer_to_user_id.eq.${session.userId}`,
    );
  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      {
        error:
          "Could not load live calls. Apply migration 135 before deployment.",
      },
      { status: 503 },
    );
  return NextResponse.json(
    {
      configured: selfHostedMediaAllowed(livekit),
      supervisor,
      userId: session.userId,
      calls: data || [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
