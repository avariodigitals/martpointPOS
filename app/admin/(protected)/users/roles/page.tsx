"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

type Rule = { role_name: string; permission_key: string; effect: "allow" | "deny" }
const label = (key: string) => key.split(/[.:_]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" · ")
const group = (key: string) => key.startsWith("finance:") || key.startsWith("finance.") ? "Finance" : key.startsWith("careers.") ? "Careers" : key.startsWith("creator.") ? "Creator Network" : "Workspace access"

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<string[]>([])
  const [role, setRole] = useState("")
  const [keys, setKeys] = useState<string[]>([])
  const [baselines, setBaselines] = useState<Record<string, string[]>>({})
  const [allRules, setAllRules] = useState<Rule[]>([])
  const [rules, setRules] = useState<Record<string, "allow" | "deny">>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/roles/permissions", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load role permissions")
      setRoles(data.roles || [])
      setRole((current) => current || data.roles?.[0] || "")
      setKeys(data.permissionKeys || [])
      setBaselines(data.baselines || {})
      setAllRules(data.overrides || [])
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load role permissions") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => setRules(Object.fromEntries(allRules.filter((item) => item.role_name === role).map((item) => [item.permission_key, item.effect]))), [allRules, role])

  const groups = useMemo(() => [...new Set(keys.map(group))], [keys])

  async function save() {
    setSaving(true); setMessage("")
    try {
      const response = await fetch("/api/admin/roles/permissions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, overrides: Object.entries(rules).map(([permission_key, effect]) => ({ permission_key, effect })) }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not save role permissions")
      setMessage(`Saved ${data.count} role-wide permission rule${data.count === 1 ? "" : "s"}.`)
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save role permissions") }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Team users</Link>
    <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck className="h-6 w-6" />Role permissions</h1><p className="mt-1 text-sm text-muted-foreground">Set permissions shared by everyone in a role. Personal permissions override these role rules; Admin access stays fixed.</p></div>
    <label className="block max-w-sm text-sm font-medium">Role<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1.5 w-full rounded-md border bg-background px-3 py-2">{roles.map((item) => <option key={item}>{item}</option>)}</select></label>
    {message && <p role="status" className="text-sm text-blue-800">{message}</p>}
    {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : groups.map((name) => <section key={name} className="overflow-hidden rounded-lg border bg-card"><h2 className="border-b px-4 py-3 text-sm font-semibold">{name}</h2><div className="divide-y">{keys.filter((key) => group(key) === name).map((key) => {
      const effect: "inherit" | "allow" | "deny" = rules[key] || "inherit"
      const baseline = (baselines[role] || []).includes(key)
      const effective = effect !== "deny" && (effect === "allow" || baseline)
      return <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">{label(key)}</p><p className="text-xs text-muted-foreground">{key} · built-in: {baseline ? "allowed" : "not allowed"} · effective: {effective ? "allowed" : "not allowed"}</p></div><select value={effect} onChange={(event) => setRules((current) => { const next = { ...current }; if (event.target.value === "inherit") delete next[key]; else next[key] = event.target.value as "allow" | "deny"; return next })} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="inherit">Inherit built-in role</option><option value="allow">Allow for this role</option><option value="deny">Deny for this role</option></select></div>
    })}</div></section>)}
    {!loading && <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !role}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save role rules</Button></div>}
  </div>
}
