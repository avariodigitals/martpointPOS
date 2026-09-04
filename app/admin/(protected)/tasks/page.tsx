"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ClipboardList, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import type { AdminTask } from "@/lib/tasks"

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

const TYPE_ICONS: Record<string, typeof CheckCircle2> = {
  SUPPORT_UNASSIGNED: CheckCircle2,
  SLA_BREACH: XCircle,
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [filter, setFilter] = useState<string>("")

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/tasks")
      const data = await res.json()
      if (data.success && data.tasks) {
        setTasks(data.tasks as AdminTask[])
      } else {
        setMessage(data.error || "Failed to load tasks")
      }
    } catch {
      setMessage("Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const filtered = useMemo(() => {
    return filter
      ? tasks.filter((t) => (t.task_type || "").toLowerCase().includes(filter.toLowerCase()) || (t.title || "").toLowerCase().includes(filter.toLowerCase()))
      : tasks
  }, [tasks, filter])

  async function markStatus(task: AdminTask, status: "DONE" | "DISMISSED") {
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      })
      const data = await res.json()
      if (data.success) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
      } else {
        setMessage(data.error || "Failed to update task")
      }
    } catch {
      setMessage("Failed to update task")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Action Centre
          </h2>
          <p className="text-muted-foreground">Generated admin tasks from across the platform.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTasks}>Refresh</Button>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div>
        <input
          type="text"
          placeholder="Filter tasks..."
          className="w-full sm:w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tasks ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No open tasks. You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const Icon = TYPE_ICONS[t.task_type] || CheckCircle2
                return (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{t.title}</p>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium text-muted-foreground">
                          {t.task_type}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Due: {fmtDate(t.due_at)} · Status: {t.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.deep_link && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={t.deep_link}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Open
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" onClick={() => markStatus(t, "DONE")}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Done
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => markStatus(t, "DISMISSED")}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
