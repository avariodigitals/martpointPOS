"use client"
import { useEffect, useState } from "react"
type Conversation = {
  id: string
  queue: string
  assigned_admin_user_id: string | null
  status: string
}
type Agent = { user_id: string; name?: string; queues: string[] }
export function ConversationRouting({
  conversation,
  onUpdate,
}: {
  conversation: Conversation | null
  onUpdate: (updates: Record<string, unknown>) => Promise<void>
}) {
  const [agents, setAgents] = useState<Agent[]>([]),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void fetch("/api/azera/presence", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load online agents")
        const data = await response.json()
        setAgents(data.online || [])
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load agents"
          )
      })
    return () => controller.abort()
  }, [open])
  async function update(value: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      await onUpdate(value)
      setOpen(false)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update routing"
      )
    } finally {
      setBusy(false)
    }
  }
  if (!conversation) return null
  const queueLabel = {
    sales: "Sales",
    support: "Technical support",
    customer_support: "Customer support",
  } as Record<string, string>
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">Queue:</span>{" "}
          {queueLabel[conversation.queue] || "Customer support"} ·{" "}
          {conversation.assigned_admin_user_id
            ? "Assigned to a team member"
            : "Waiting for an agent"}
        </p>
        <button
          disabled={conversation.status === "closed"}
          onClick={() => {
            setOpen(!open)
            setError("")
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Transfer / route chat
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <p className="text-xs text-slate-500">
            Chat transfer keeps the complete conversation history. Telephone
            call transfers are a separate provider capability.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {Object.entries(queueLabel).map(([key, label]) => (
              <button
                key={key}
                disabled={busy}
                onClick={() => void update({ queue: key })}
                className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50"
              >
                Move to {label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            Find an online agent
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team name"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {agents
              .filter(
                (agent) =>
                  agent.queues.includes(conversation.queue) &&
                  (agent.name || "")
                    .toLowerCase()
                    .includes(search.toLowerCase())
              )
              .map((agent) => (
                <button
                  key={agent.user_id}
                  disabled={busy}
                  onClick={() =>
                    void update({ assigned_admin_user_id: agent.user_id })
                  }
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                >
                  Assign to {agent.name || "Team member"}
                </button>
              ))}
          </div>
          <button
            disabled={busy}
            onClick={() => void update({ assigned_admin_user_id: null })}
            className="text-sm font-medium text-blue-700 underline"
          >
            Release assignment back to queue
          </button>
        </div>
      )}
    </section>
  )
}
