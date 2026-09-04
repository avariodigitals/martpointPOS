"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

interface Task {
  id: string
  category: string
  title: string
  status: string
  required: boolean
}

export default function OnboardingWorkspacePage() {
  const { businessId } = useParams() as { businessId: string }
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/partner/customers/${businessId}/onboarding`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .finally(() => setLoading(false))
  }, [businessId])

  async function updateTask(taskId: string, status: string, notes = "") {
    const res = await fetch(`/api/partner/customers/${businessId}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status, notes }),
    })
    const data = await res.json()
    if (res.ok) setTasks(data.tasks)
  }

  async function submitComplete() {
    if (!confirm("Submit onboarding as complete?")) return
    const res = await fetch(`/api/partner/customers/${businessId}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (res.ok) alert("Onboarding submitted. MartPoint will review.")
    else alert(data.error || "Could not submit onboarding")
  }

  if (loading) return <p>Loading...</p>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Onboarding Workspace</h2>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">No onboarding tasks assigned.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.category} {task.required && "• Required"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground">{task.status}</span>
                <select
                  value={task.status}
                  onChange={(e) => updateTask(task.id, e.target.value)}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="NOT_STARTED">Not started</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={submitComplete}
        className="rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90"
      >
        Submit Onboarding Complete
      </button>
    </div>
  )
}
