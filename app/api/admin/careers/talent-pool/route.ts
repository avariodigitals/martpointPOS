import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { generateCandidateReference, PRIVACY_VERSION } from "@/lib/careers"

export const dynamic = "force-dynamic"

/* GET: list talent-pool candidates with filters. */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.talent_pool.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ candidates: [] })

  const { searchParams } = new URL(request.url)
  let query = supabase
    .from("career_candidate_profiles")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500)

  const state = searchParams.get("state")
  const city = searchParams.get("city")
  const lga = searchParams.get("lga")
  const verification = searchParams.get("verification")
  const status = searchParams.get("status")
  const teamLead = searchParams.get("teamLead")
  const role = searchParams.get("role")
  const q = searchParams.get("q")

  if (state) query = query.eq("state", state)
  if (city) query = query.ilike("city", city)
  if (lga) query = query.ilike("lga", lga)
  if (verification) query = query.eq("verification_status", verification)
  if (status) query = query.eq("status", status)
  if (teamLead === "true") query = query.eq("team_lead_eligible", true)
  if (role) query = query.contains("qualified_roles", [role])
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,reference_number.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Failed to load talent pool" }, { status: 500 })

  // Attach skills
  const ids = (data || []).map((c) => c.id)
  const skillsMap = new Map<string, string[]>()
  if (ids.length > 0) {
    const { data: skills } = await supabase
      .from("career_candidate_skills")
      .select("candidate_id, skill")
      .in("candidate_id", ids)
    for (const s of skills || []) {
      const list = skillsMap.get(s.candidate_id) || []
      list.push(s.skill)
      skillsMap.set(s.candidate_id, list)
    }
  }

  // Filter by skill + equipment client-side of the DB query
  const skill = searchParams.get("skill")?.toLowerCase()
  const equipment = searchParams.get("equipment") // e.g. owns_android
  const candidates = (data || [])
    .map((c) => ({ ...c, skills: skillsMap.get(c.id) || [] }))
    .filter((c) => !skill || (c.skills as string[]).some((s) => s.toLowerCase().includes(skill)))
    .filter((c) => {
      if (!equipment) return true
      const eq = c.equipment as Record<string, unknown>
      return eq?.[equipment] === true
    })

  return NextResponse.json({ candidates })
}

/* POST: manually create a candidate profile (admin-added, consent recorded). */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.talent_pool.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const str = (k: string) => String(body[k] ?? "").trim()
  if (!str("fullName") || !str("email")) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("career_candidate_profiles")
    .select("id")
    .ilike("email", str("email").toLowerCase())
    .is("deleted_at", null)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: "A candidate with this email already exists", id: existing.id }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("career_candidate_profiles")
    .insert({
      reference_number: generateCandidateReference(),
      full_name: str("fullName"),
      email: str("email").toLowerCase(),
      phone: str("phone") || null,
      whatsapp: str("whatsapp") || null,
      state: str("state") || null,
      lga: str("lga") || null,
      city: str("city") || null,
      qualified_roles: Array.isArray(body.qualifiedRoles) ? body.qualifiedRoles : [],
      equipment: body.equipment && typeof body.equipment === "object" ? body.equipment : {},
      availability_notes: str("availabilityNotes") || null,
      consent_talent_pool: body.consentTalentPool === true,
      privacy_version: body.consentTalentPool === true ? PRIVACY_VERSION : null,
      consent_at: body.consentTalentPool === true ? new Date().toISOString() : null,
      source: "admin_added",
    })
    .select("id, reference_number")
    .single()
  if (error) return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_CANDIDATE_CREATED,
    entityType: AUDIT_ENTITIES.CAREER_CANDIDATE,
    entityId: data.id,
    metadata: { reference: data.reference_number, source: "admin_added" },
  })

  return NextResponse.json({ success: true, id: data.id, reference: data.reference_number })
}
