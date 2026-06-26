import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

let _client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return _client
}

// Lazy wrapper — delays client creation until first use so builds don't fail
export const supabase = {
  from: (...args: Parameters<SupabaseClient["from"]>) => getClient().from(...args),
  storage: {
    from: (...args: Parameters<SupabaseClient["storage"]["from"]>) => getClient().storage.from(...args),
  },
} as unknown as SupabaseClient

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseKey.length > 0
}
