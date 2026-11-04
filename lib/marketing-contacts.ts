import { supabase } from "./supabase"

/** Import/export and audience counts must work beyond the default 1,000-row window. */
export async function loadMarketingContacts(audienceId?: string) {
  type Contact = { id: string; audience_id: string; email: string | null; phone: string | null; name: string; sms_consent_at: string | null; created_at: string }
  const contacts: Contact[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("marketing_contacts").select("id,audience_id,email,phone,name,sms_consent_at,created_at")
      .order("id", { ascending: true }).range(offset, offset + 999)
    if (audienceId) query = query.eq("audience_id", audienceId)
    const { data, error } = await query
    if (error) return { data: [], error }
    contacts.push(...(data || []))
    if (!data || data.length < 1000) return { data: contacts, error: null }
  }
}
