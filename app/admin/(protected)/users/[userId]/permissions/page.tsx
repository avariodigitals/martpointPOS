"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

type Override = { permission_key: string; effect: "allow" | "deny" }
type UserInfo = { id: string; name: string; username: string; role: string; status: string }

function label(key: string) {
  return key.split(/[.:_]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" · ")
}
function group(key: string) {
  if (key.startsWith("finance:")) return "Finance actions"
  if (key.startsWith("careers.")) return "Careers"
  if (key.startsWith("creator.")) return "Creator Network"
  return "Workspace access"
}

export default function UserPermissionsPage() {
  const params = useParams<{ userId: string }>()
  const userId = params.userId
  const [user, setUser] = useState<UserInfo | null>(null)
  const [keys, setKeys] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, "allow" | "deny">>({})
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/permissions`)
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load permissions")
      setUser(data.user)
      setKeys(data.permissionKeys || [])
      setOverrides(Object.fromEntries((data.overrides || []).map((item: Override) => [item.permission_key, item.effect])))
      setRolePermissions(data.rolePermissions || [])
      if (data.user.role === "Admin") throw new Error("Admin accounts use global access and do not have personal overrides")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load permissions") }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const groups = useMemo(() => [...new Set(keys.map(group))], [keys])

  async function save() {
    setSaving(true); setMessage("")
    try {
      const response = await fetch(`/api/admin/users/${userId}/permissions`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides: Object.entries(overrides).map(([permission_key, effect]) => ({ permission_key, effect })) }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not save permissions")
      setMessage(`Saved ${data.count} personal override${data.count === 1 ? "" : "s"}.`)
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save permissions") }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Team users</Link>
    <div><h1 className="text-2xl font-semibold">Personal permissions</h1><p className="mt-1 text-sm text-muted-foreground">Role permissions provide the baseline. Use Allow or Deny for an individual exception; Deny takes precedence over the role.</p></div>
    {user && <div className="rounded-lg border bg-card p-4"><p className="font-medium">{user.name}</p><p className="text-sm text-muted-foreground">@{user.username} · {user.role} · {user.status}</p></div>}
    {message && <p role="status" className="text-sm text-blue-800">{message}</p>}
    {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : groups.map((name) => <section key={name} className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">{name}</h2>
      <div className="divide-y">{keys.filter((key) => group(key) === name).map((key) => {
        const override = overrides[key] || "inherit"
        const grantedByRole = rolePermissions.includes(key)
        return <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div><p className="text-sm font-medium">{label(key)}</p><p className="text-xs text-muted-foreground">{key} · role baseline: {grantedByRole ? "allowed" : "not allowed"}</p></div>
          <select value={override} onChange={(event) => setOverrides((current) => {
            const next = { ...current }
            if (event.target.value === "inherit") delete next[key]
            else next[key] = event.target.value as "allow" | "deny"
            return next
          })} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="inherit">Inherit role</option><option value="allow">Allow for this person</option><option value="deny">Deny for this person</option>
          </select>
        </div>
      })}</div>
    </section>)}
    {!loading && <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !user || user.role === "Admin"}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save permissions</Button></div>}
  </div>
}
