import { supabase } from "./supabase"
import type { CampaignSend } from "./email-campaign-report"

/** PostgREST defaults to 1,000 rows; campaign totals must include every page. */
export async function loadMarketingSends(campaignId?: string) {
  const sends: (CampaignSend & { campaign_id: string })[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("marketing_sends")
      .select("id, campaign_id, email, name, status, error_message, sent_at, opened_at, open_count, clicked_at, click_count")
      .order("id", { ascending: true }).range(offset, offset + 999)
    if (campaignId) query = query.eq("campaign_id", campaignId)
    const { data, error } = await query
    if (error) return { data: [], error }
    sends.push(...(data || []))
    if (!data || data.length < 1000) return { data: sends, error: null }
  }
}
