import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { syncAdminTasks, listAdminTasks, updateAdminTask, type AdminTaskStatus } from "@/lib/tasks"

/* ─── GET ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("tasks", "view")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as AdminTaskStatus | null
    const sync = searchParams.get("sync") !== "false" // default sync

    const tasks = sync ? await syncAdminTasks() : await listAdminTasks(status ?? undefined)
    const filtered = status ? tasks.filter((t) => t.status === status) : tasks
    return NextResponse.json({ success: true, tasks: filtered })
  } catch (err) {
    console.error("[Tasks API GET]", err)
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 })
  }
}

/* ─── POST: mark task status ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("tasks", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, status } = body as { id?: string; status?: AdminTaskStatus }

    if (!id || !status) {
      return NextResponse.json({ error: "Task id and status required" }, { status: 400 })
    }

    const task = await updateAdminTask(id, status, session.userId)
    return NextResponse.json({ success: true, task })
  } catch (err) {
    console.error("[Tasks API POST]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
