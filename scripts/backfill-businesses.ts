/* ───────────────────────────  Backfill: Won leads → businesses  ───────────────────────────
 * Admin-safe migration tool for historical Won leads.
 *
 *   - previews records first
 *   - detects possible duplicates
 *   - is idempotent (skips leads already linked to a business)
 *   - does NOT delete anything
 *   - produces a migration summary
 *
 * Usage:
 *   npx tsx scripts/backfill-businesses.ts            # preview only
 *   npx tsx scripts/backfill-businesses.ts --apply    # perform conversion
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const apply = process.argv.includes("--apply")

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface Lead {
  id: string
  full_name: string
  business_name: string
  email: string
  phone: string
  business_type: string
  product_interest: string
  source: string
  status: string
}

function normalizeSource(source: string): string {
  const s = (source || "").toUpperCase()
  if (["DIRECT", "PARTNER", "REFERRAL", "WEBSITE", "SOCIAL", "CAMPAIGN", "OTHER"].includes(s)) return s
  if (s === "MANUAL") return "DIRECT"
  return "OTHER"
}

async function main() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", "Won")
    .order("submitted_at", { ascending: true })

  if (error) {
    console.error("Failed to load Won leads:", error.message)
    process.exit(1)
  }

  console.log(`\n=== Backfill: Won leads → businesses ===`)
  console.log(`Mode: ${apply ? "APPLY" : "PREVIEW (no changes)"}`)
  console.log(`Won leads found: ${leads?.length ?? 0}\n`)

  if (!leads || leads.length === 0) {
    console.log("Nothing to backfill.")
    return
  }

  // Find which leads already have a business (idempotency).
  const leadIds = leads.map((l) => l.id)
  const { data: existing } = await supabase
    .from("businesses")
    .select("source_lead_id")
    .in("source_lead_id", leadIds)
  const alreadyLinked = new Set((existing || []).map((b: { source_lead_id: string }) => b.source_lead_id))

  // Duplicate detection by email.
  const { data: existingBiz } = await supabase
    .from("businesses")
    .select("id, business_name, primary_email")
  const emailIndex = new Map<string, { id: string; businessName: string }>()
  for (const b of existingBiz || []) {
    emailIndex.set((b as { primary_email: string }).primary_email?.toLowerCase(), {
      id: (b as { id: string }).id,
      businessName: (b as { business_name: string }).business_name,
    })
  }

  let created = 0
  let skippedAlready = 0
  let skippedDuplicate = 0
  const duplicates: string[] = []

  for (const lead of leads as Lead[]) {
    const tag = `[${lead.id}] ${lead.business_name} <${lead.email}>`
    if (alreadyLinked.has(lead.id)) {
      skippedAlready++
      console.log(`SKIP (already linked): ${tag}`)
      continue
    }
    const dup = emailIndex.get(lead.email?.toLowerCase())
    if (dup) {
      skippedDuplicate++
      duplicates.push(`${tag} → existing business ${dup.id} (${dup.businessName})`)
      console.log(`WARN (possible duplicate email): ${tag} → ${dup.id}`)
      // Do not auto-merge; surface for manual review.
      continue
    }

    if (!apply) {
      console.log(`PREVIEW create: ${tag}`)
      continue
    }

    const now = new Date().toISOString()
    const { data: createdRow, error: insErr } = await supabase
      .from("businesses")
      .insert({
        business_name: lead.business_name,
        primary_contact_name: lead.full_name,
        primary_email: lead.email,
        primary_phone: lead.phone,
        business_type: lead.business_type,
        status: "ACTIVE",
        source: normalizeSource(lead.source),
        source_lead_id: lead.id,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (insErr || !createdRow) {
      console.error(`FAILED create: ${tag} — ${insErr?.message}`)
      continue
    }
    emailIndex.set(lead.email?.toLowerCase(), {
      id: createdRow.id,
      businessName: createdRow.business_name,
    })
    created++
    console.log(`CREATED: ${tag} → ${createdRow.id}`)
  }

  console.log(`\n=== Migration Summary ===`)
  console.log(`Total Won leads:        ${leads.length}`)
  console.log(`Already linked (skip):  ${skippedAlready}`)
  console.log(`Duplicate email (skip): ${skippedDuplicate}`)
  console.log(`${apply ? "Created" : "Would create"}:        ${apply ? created : leads.length - skippedAlready - skippedDuplicate}`)
  if (duplicates.length) {
    console.log(`\nDuplicate warnings (manual review required):`)
    for (const d of duplicates) console.log(`  - ${d}`)
  }
  if (!apply) {
    console.log(`\nPreview only. Re-run with --apply to perform the conversion.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
