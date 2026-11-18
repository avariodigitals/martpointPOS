import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { createGrowthProgramme, growthQuestionnaireSchema } from "@/lib/business-growth-programme"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(20).max(4000),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  onboardingScope: z.string().trim().min(10).max(2000),
  exclusions: z.string().trim().min(10).max(1500),
  renewalPriceNote: z.string().trim().min(5).max(1000),
  termsText: z.string().trim().min(30).max(8000),
  privacyText: z.string().trim().min(30).max(8000),
  capabilityReference: z.string().trim().min(50).max(12000),
  questions: growthQuestionnaireSchema.optional(),
}).refine((value) => new Date(value.closesAt) > new Date(value.opensAt), { path: ["closesAt"], message: "Closing date must be after opening date." })

export async function GET() {
  const { denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ programmes: [] })
  const { data, error } = await supabase.from("business_growth_programmes").select("id,name,slug,status,opens_at,closes_at,award_count,sponsored_duration_months,plan_snapshot,created_at").order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Could not load programmes" }, { status: 500 })
  const ids = (data || []).map((program) => program.id)
  const [apps, awards] = ids.length ? await Promise.all([
    supabase.from("business_growth_applications").select("programme_id").in("programme_id", ids),
    supabase.from("business_growth_awards").select("programme_id,status").in("programme_id", ids),
  ]) : [{ data: [] as { programme_id: string }[] }, { data: [] as { programme_id: string; status: string }[] }]
  return NextResponse.json({ programmes: (data || []).map((program) => ({
    ...program,
    applicationCount: (apps.data || []).filter((app) => app.programme_id === program.id).length,
    awardCount: (awards.data || []).filter((award) => award.programme_id === program.id && ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(award.status)).length,
  })) })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid programme details" }, { status: 400 })
    if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    const result = await createGrowthProgramme({ ...parsed.data, createdBy: session!.userId })
    await supabase.from("business_growth_events").insert({ programme_id: result.id, actor_admin_user_id: session!.userId, event_type: "PROGRAMME_CREATED", details: { slug: result.slug } })
    return NextResponse.json({ success: true, programme: result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Programme could not be created"
    return NextResponse.json({ error: message.includes("duplicate key") ? "That programme URL is already in use." : message }, { status: 400 })
  }
}
