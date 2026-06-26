import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key)

const VERIFICATION_CODE = "eMEUcMNlMEWRfeeuFmiyz-fQy9nqHLjfSyWpIMmqaAc"

async function main() {
  // Read current settings
  const { data, error: readError } = await supabase
    .from("settings")
    .select("data")
    .eq("id", 1)
    .single()

  if (readError) {
    console.error("Error reading settings:", readError)
    process.exit(1)
  }

  const current = (data?.data as Record<string, unknown>) || {}

  const updated = {
    ...current,
    searchConsole: {
      ...(current.searchConsole as Record<string, unknown> || {}),
      verificationCode: VERIFICATION_CODE,
    },
  }

  const { error: writeError } = await supabase
    .from("settings")
    .upsert({ id: 1, data: updated, updated_at: new Date().toISOString() })

  if (writeError) {
    console.error("Error writing settings:", writeError)
    process.exit(1)
  }

  console.log("✅ Search Console verification code updated successfully")
  console.log("Code:", VERIFICATION_CODE)
}

main()
