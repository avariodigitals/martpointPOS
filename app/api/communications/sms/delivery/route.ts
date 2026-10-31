import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { pick, readAfricaRequest } from "@/lib/africastalking"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  const expected = process.env.COMMUNICATION_SMS_CALLBACK_SECRET || process.env.AFRICASTALKING_CALLBACK_SECRET
  const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret")
  if (!expected || provided !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { payload } = await readAfricaRequest(request)
  const id = pick(payload, "id", "messageId", "message_id")
  const state = pick(payload, "status", "delivery_status").toLowerCase()
  const delivered = ["success", "delivered", "delivrd"].includes(state)
  const failed = ["failed", "rejected", "expired", "undeliverable", "undeliv"].includes(state)
  if (!id || (!delivered && !failed)) return NextResponse.json({ ok: true, ignored: true })
  const result = await supabase.from("communication_messages").update({ status: delivered ? "delivered" : "failed", error: failed ? "Provider reported delivery failure" : null })
    .eq("channel", "sms").eq("provider_message_id", id).in("status", ["accepted", "unknown"]).select("run_id")
  if (result.error) return NextResponse.json({ error: "Could not save delivery report" }, { status: 503 })
  if (failed) for (const row of result.data || []) if (row.run_id) await supabase.from("communication_runs").update({ status: "paused", reason: "Provider reported delivery failure" }).eq("id", row.run_id).eq("status", "active")
  return NextResponse.json({ ok: true })
}
