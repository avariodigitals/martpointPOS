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
      .select("id,status,answered_at,sip_provider,direction")
      .eq("id", id)
      .eq("agent_user_id", session.userId)
      .in("sip_provider", ["africas_talking_browser", "africas_talking"])
      .maybeSingle()
    if (!call) return err("Call not found or not owned by you.", 404)
    const body = await request.json()
    if (call.sip_provider === "africas_talking" && call.direction !== "inbound")
      return err("This is not a browser phone call.", 400)
    if (!["ringing", "active"].includes(call.status))
      return NextResponse.json({ status: call.status })
    const status = body.status
    if (!["active", "ended", "missed", "failed", "busy"].includes(status))
      return err("Invalid call status.", 400)
    const now = new Date().toISOString()
    // Declining one browser leg must not end the customer's parent call:
    // Africa's Talking may still be trying a configured phone/SIP fallback.
    if (call.sip_provider === "africas_talking" && call.status === "ringing" && !call.answered_at && status !== "active") {
      const { data: attempts, error: attemptsError } = await supabase.from("azera_call_attempts")
        .select("id,destination").eq("call_id", id).in("status", ["dialing", "ringing"])
      if (attemptsError) return err("Could not save this call attempt.", 503)
      const suffix = `.mp_agent_${session.userId.replaceAll("-", "")}`
      for (const attempt of attempts || []) {
        if (String(attempt.destination).endsWith(suffix)) {
          const { error } = await supabase.from("azera_call_attempts")
            .update({ status: "rejected", ended_at: now }).eq("id", attempt.id)
          if (error) return err("Could not save this call attempt.", 503)
        }
      }
      const { error } = await supabase.from("azera_calls")
        .update({ agent_user_id: null, agent_name: null, updated_at: now })
        .eq("id", id).eq("agent_user_id", session.userId).eq("status", "ringing")
      if (error) return err("Could not release the browser call attempt.", 503)
      await supabase.from("azera_call_events").insert({ call_id: id, event_type: "missed", actor_type: "agent", actor_id: session.userId, metadata: { source: "browser_sdk", scope: "browser_leg", fallback_pending: true } })
      return NextResponse.json({ status: "ringing", browserLegEnded: true })
    }
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
