import { supabase } from "@/lib/supabase"

export async function saveAzeraCallNote(input: { callId: string; summary: string; outcome: string; actionItems?: string[]; source?: "ai" | "staff" | "campaign"; authorName?: string }) {
  const { data: call, error: callError } = await supabase.from("azera_calls").select("id,lead_id,business_id,creator_id,creator_application_id,conversation_id,agent_user_id,agent_name,selected_department,customer_name").eq("id", input.callId).maybeSingle()
  if (callError || !call) throw new Error("Call was not found for this summary.")
  const { data: saved, error } = await supabase.from("azera_call_summaries").upsert({ call_id: call.id, summary: input.summary.slice(0, 5000), action_items: (input.actionItems || []).slice(0, 20), outcome: input.outcome, summary_status: "complete", summary_source: input.source || "campaign", author_name: input.authorName || "Azera", updated_at: new Date().toISOString() }, { onConflict: "call_id" }).select("id").single()
  if (error || !saved) throw new Error("Call summary could not be saved.")
  const linked = [
    call.lead_id && { entity_type: "lead", entity_id: call.lead_id, entity_label: call.customer_name },
    call.business_id && { entity_type: "business", entity_id: call.business_id, entity_label: null },
    call.creator_id && { entity_type: "creator", entity_id: call.creator_id, entity_label: call.customer_name },
    call.creator_application_id && { entity_type: "creator_application", entity_id: call.creator_application_id, entity_label: call.customer_name },
    call.conversation_id && { entity_type: "conversation", entity_id: call.conversation_id, entity_label: call.customer_name },
    call.agent_user_id && { entity_type: "user", entity_id: call.agent_user_id, entity_label: call.agent_name },
    call.selected_department && { entity_type: "team", entity_id: call.selected_department, entity_label: call.selected_department },
  ].filter(Boolean)
  if (linked.length) {
    const { error: linkError } = await supabase.from("azera_call_summary_links").upsert(linked.map((link) => ({ ...link!, summary_id: saved.id })), { onConflict: "summary_id,entity_type,entity_id", ignoreDuplicates: true })
    if (linkError) throw new Error("Call summary was saved but its related note links could not be created.")
  }
  return saved.id
}
