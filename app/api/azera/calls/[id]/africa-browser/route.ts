import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
const err = (error: string, status: number) =>
  NextResponse.json({ error }, { status })
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera"))
    return err("Forbidden", 403)
  try {
    const { id } = await params
    const { data: call } = await supabase
      .from("azera_calls")
      .select("id,status,answered_at")
      .eq("id", id)
      .eq("agent_user_id", session.userId)
      .eq("sip_provider", "africas_talking_browser")
      .maybeSingle()
    if (!call) return err("Call not found or not owned by you.", 404)
    const body = await request.json()
    if (!["ringing", "active"].includes(call.status))
      return NextResponse.json({ status: call.status })
    const status = body.status
    if (!["active", "ended", "missed", "failed", "busy"].includes(status))
      return err("Invalid call status.", 400)
    const now = new Date().toISOString()
    if (status === "active" && call.status === "active") {
      const { error } = await supabase
        .from("azera_calls")
        .update({ updated_at: now })
        .eq("id", id)
        .eq("status", "active")
      return error
        ? err("Could not refresh call history.", 503)
        : NextResponse.json({ status: "active" })
    }
    const { data, error } = await supabase
      .from("azera_calls")
      .update({
        status,
        updated_at: now,
        ...(status === "active"
          ? { answered_at: call.answered_at || now }
          : {
              ended_at: now,
              duration_seconds: call.answered_at
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.now() - Date.parse(call.answered_at)) / 1000
                    )
                  )
                : 0,
            }),
      })
      .eq("id", id)
      .eq("status", call.status)
      .select("status")
      .maybeSingle()
    if (error) return err("Could not save call status.", 500)
    if (!data)
      return err("The call state changed. Retry saving the latest state.", 409)
    if (data)
      await supabase
        .from("azera_call_events")
        .insert({
          call_id: id,
          event_type: status === "active" ? "answered" : status,
          actor_type: "agent",
          actor_id: session.userId,
          metadata: {
            provider: "africas_talking_browser",
            source: "browser_sdk",
          },
        })
    return NextResponse.json({ status: data?.status || call.status })
  } catch {
    return err("Could not save call status.", 500)
  }
}
