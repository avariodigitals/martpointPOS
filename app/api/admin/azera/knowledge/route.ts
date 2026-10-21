import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(10).max(30000),
  keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  category: z.string().trim().min(1).max(80).default("General"),
  audience: z.enum(["all", "prospect", "merchant", "agent"]).default("all"),
  source_url: z.string().trim().url().or(z.literal("")).nullable().default(null),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  sort_order: z.number().int().default(0),
})

async function authorize() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) return null
  return session
}

async function resolveBusinessId() {
  const configured = process.env.AZERA_PUBLIC_BUSINESS_ID?.trim()
  if (configured) return configured
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.id as string | undefined) || null
}

export async function GET() {
  if (!(await authorize())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ articles: [], faqs: [] })

  const businessId = await resolveBusinessId()
  if (!businessId) return NextResponse.json({ error: "No business is configured" }, { status: 400 })

  const [{ data: articles, error }, { data: faqs }] = await Promise.all([
    supabase.from("azera_knowledge").select("*").eq("business_id", businessId).order("sort_order").order("updated_at", { ascending: false }),
    supabase.from("faqs").select("id, question, answer, sort_order").order("sort_order"),
  ])
  if (error) return NextResponse.json({ error: "Failed to load knowledge base" }, { status: 500 })
  return NextResponse.json({ articles: articles || [], faqs: faqs || [] })
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  try {
    const body = articleSchema.omit({ id: true }).parse(await request.json())
    const businessId = await resolveBusinessId()
    if (!businessId) return NextResponse.json({ error: "No business is configured" }, { status: 400 })
    const { data, error } = await supabase.from("azera_knowledge").insert({ ...body, business_id: businessId, source_url: body.source_url || null }).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, article: data })
  } catch (error) {
    console.error("[Azera knowledge create error]", error)
    return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid article details" : "Failed to create article" }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  try {
    const body = articleSchema.parse(await request.json())
    if (!body.id) return NextResponse.json({ error: "Article id is required" }, { status: 400 })
    const businessId = await resolveBusinessId()
    if (!businessId) return NextResponse.json({ error: "No business is configured" }, { status: 400 })
    const { id, ...updates } = body
    const { data, error } = await supabase.from("azera_knowledge").update({ ...updates, source_url: updates.source_url || null, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, article: data })
  } catch (error) {
    console.error("[Azera knowledge update error]", error)
    return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid article details" : "Failed to update article" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Article id is required" }, { status: 400 })
  const businessId = await resolveBusinessId()
  if (!businessId) return NextResponse.json({ error: "No business is configured" }, { status: 400 })
  const { error } = await supabase.from("azera_knowledge").delete().eq("id", id).eq("business_id", businessId)
  if (error) return NextResponse.json({ error: "Failed to delete article" }, { status: 500 })
  return NextResponse.json({ success: true })
}
