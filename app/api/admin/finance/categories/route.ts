import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import crypto from "crypto"

export async function GET() {
  const { denied } = await authorizeAdmin("finance")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ categories: [] })
  }

  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[finance/categories] GET", error)
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 })
  }

  return NextResponse.json({ categories: data || [] })
}

export async function POST(request: Request) {
  const { denied } = await authorizeAdmin("finance")
  if (denied) return denied

  try {
    const body = await request.json()
    const { type, name } = body as { type: string; name: string }

    if (!type || !name || !["expense", "income"].includes(type)) {
      return NextResponse.json({ error: "Valid type and name are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("finance_categories")
      .insert({
        id: crypto.randomUUID(),
        type,
        name: name.trim(),
        active: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes("unique constraint")) {
        return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 })
      }
      console.error("[finance/categories] POST", error)
      return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
    }

    return NextResponse.json({ success: true, category: data })
  } catch {
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const { denied } = await authorizeAdmin("finance")
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, name, active, sort_order } = body as { id: string; name?: string; active?: boolean; sort_order?: number }

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name.trim()
    if (active !== undefined) updateData.active = active
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data, error } = await supabase
      .from("finance_categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[finance/categories] PUT", error)
      return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
    }

    return NextResponse.json({ success: true, category: data })
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { denied } = await authorizeAdmin("finance")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { error } = await supabase.from("finance_categories").delete().eq("id", id)
    if (error) {
      console.error("[finance/categories] DELETE", error)
      return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
