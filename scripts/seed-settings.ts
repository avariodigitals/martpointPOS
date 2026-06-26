/**
 * Seed settings from data/settings.json into Supabase
 * Run: npx tsx scripts/seed-settings.ts
 */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seed() {
  const settingsPath = path.join(process.cwd(), "data", "settings.json")
  if (!fs.existsSync(settingsPath)) {
    console.log("No settings.json found. Nothing to seed.")
    return
  }

  const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))

  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: "id" })

  if (error) {
    console.error("Seed failed:", error.message)
    process.exit(1)
  }

  console.log("Settings seeded successfully.")
}

seed()
