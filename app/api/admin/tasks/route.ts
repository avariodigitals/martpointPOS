import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { generateAdminTasks, type AdminTask } from "@/lib/tasks"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_RE.test(value)
}

/* ─── GET ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("dashboard", "view")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const tasks = await generateAdminTasks()
    const filtered = status ? tasks.filter((t: AdminTask) => t.status === status) : tasks
    return NextResponse.json({ success: true, tasks: filtered })
  } catch (err) {
    console.error("[Tasks API GET]", err)
    return NextResponse.json({ error: "Failed to generate tasks" }, { status: 500 })
  }
}

/* ─── POST: mark task status ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("dashboard", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, status } = body as { id?: string; status?: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" }

    if (!id || !status) {
      return NextResponse.json({ error: "Task id and status required" }, { status: 400 })
    }

    if (isSupabaseConfigured() && isUuid(id)) {
      const { data } = await supabase
        .from("admin_tasks")
        .select("id")
        .eq("id", id)
        .maybeSingle()

      if (data) {
        const { error } = await supabase
          .from("admin_tasks")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id)
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true, id, status })
  } catch (err) {
    console.error("[Tasks API POST]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
