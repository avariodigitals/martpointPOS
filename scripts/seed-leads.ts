/**
 * Seed leads from data/leads.json into Supabase
 * Run: npx tsx scripts/seed-leads.ts
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
  const leadsPath = path.join(process.cwd(), "data", "leads.json")
  if (!fs.existsSync(leadsPath)) {
    console.log("No leads.json found. Nothing to seed.")
    return
  }

  const raw = JSON.parse(fs.readFileSync(leadsPath, "utf-8"))
  const leads = raw.leads || []

  if (leads.length === 0) {
    console.log("No leads to seed.")
    return
  }

  const rows = leads.map((l: Record<string, unknown>) => ({
    id: l.id,
    full_name: l.fullName,
    business_name: l.businessName,
    email: l.email,
    phone: l.phone,
    business_type: l.businessType,
    product_interest: l.productInterest,
    branches: l.branches,
    staff_size: l.staffSize,
    challenge: l.challenge || "",
    message: l.message || "",
    source: l.source || "website",
    status: l.status || "New",
    assigned_to: l.assignedTo || "",
    notes: l.notes || "",
    submitted_at: l.submittedAt,
    updated_at: l.updatedAt,
  }))

  const { error } = await supabase.from("leads").upsert(rows, { onConflict: "id" })

  if (error) {
    console.error("Seed failed:", error.message)
    process.exit(1)
  }

  console.log(`Seeded ${rows.length} lead(s) successfully.`)
}

seed()
