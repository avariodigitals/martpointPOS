import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { listComponents } from "@/lib/status-page"

const VALID_STATUSES = ["operational", "degraded_performance", "partial_outage", "major_outage", "under_maintenance"]

export async function GET() {
  const { denied } = await authorizeAdmin("status")
  if (denied) return denied

  return NextResponse.json({ components: await listComponents() })
}

export async function POST(request: Request) {
  const { denied } = await authorizeAdmin("status", "create")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("status_components")
      .insert({
        name: body.name.trim(),
        description: body.description || "",
        group_name: body.groupName || "",
        status: VALID_STATUSES.includes(body.status) ? body.status : "operational",
        sort_order: Number(body.sortOrder) || 0,
        showcase: body.showcase !== false,
      })
      .select()
      .single()

    if (error || !data) {
      console.error("[admin/status/components] POST", error)
      return NextResponse.json({ error: "Failed to create component" }, { status: 500 })
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true, id: data.id })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { denied } = await authorizeAdmin("status", "update")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updateData.name = String(body.name).trim()
    if (body.description !== undefined) updateData.description = body.description || ""
    if (body.groupName !== undefined) updateData.group_name = body.groupName || ""
    if (body.status !== undefined && VALID_STATUSES.includes(body.status)) updateData.status = body.status
    if (body.sortOrder !== undefined) updateData.sort_order = Number(body.sortOrder) || 0
    if (body.showcase !== undefined) updateData.showcase = body.showcase !== false

    const { error } = await supabase.from("status_components").update(updateData).eq("id", body.id)
    if (error) {
      console.error("[admin/status/components] PUT", error)
      return NextResponse.json({ error: "Failed to update component" }, { status: 500 })
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { denied } = await authorizeAdmin("status", "delete")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("status_components").delete().eq("id", id)
    if (error) {
      console.error("[admin/status/components] DELETE", error)
      return NextResponse.json({ error: "Failed to delete component" }, { status: 500 })
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
