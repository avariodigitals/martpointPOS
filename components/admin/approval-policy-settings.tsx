"use client"

import { useCallback, useEffect, useState } from "react"
import { ALL_ROLES, type UserRole } from "@/lib/admin-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react"

type ApprovalPolicy = { action_key: string; label: string; enabled: boolean; approver_roles: UserRole[]; approver_user_ids: string[] }
type StaffUser = { id: string; name: string; username: string; role: UserRole }

export function ApprovalPolicySettings() {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/approvals", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load approval rules")
      if (!data.canManagePolicies) throw new Error("Only Admins can configure approval rules")
      setPolicies(data.policies || [])
      setUsers(data.users || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load approval rules")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  function updatePolicy(key: string, updates: Partial<ApprovalPolicy>) {
    setPolicies((current) => current.map((policy) => policy.action_key === key ? { ...policy, ...updates } : policy))
  }

  async function save(policy: ApprovalPolicy) {
    setBusy(policy.action_key)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_policy", actionKey: policy.action_key, enabled: policy.enabled, approverRoles: policy.approver_roles, approverUserIds: policy.approver_user_ids }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not save approval rule")
      setMessage("Approval rule saved.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save approval rule")
    } finally {
      setBusy("")
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Approval Rules &amp; Workflows</h1><p className="mt-1 text-sm text-muted-foreground">Choose which actions need approval and who can authorize them.</p></div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Approval rules</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && policies.map((policy) => <div key={policy.action_key} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium">{policy.label}</p><p className="text-xs text-muted-foreground">{policy.action_key}</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(event) => updatePolicy(policy.action_key, { enabled: event.target.checked })} />Require approval</label>
          </div>
          {policy.action_key === "quotation.send" && <p className="mt-2 text-xs text-muted-foreground">Assign the Technical Lead or Sales Head by selecting their individual user account. Admins can also approve. Approval returns the draft to its creator; it does not email the client.</p>}
          {policy.enabled && <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <fieldset><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Approver roles</legend><div className="flex flex-wrap gap-x-4 gap-y-2">
              {ALL_ROLES.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.approver_roles.includes(role)} onChange={(event) => updatePolicy(policy.action_key, { approver_roles: event.target.checked ? [...policy.approver_roles, role] : policy.approver_roles.filter((item) => item !== role) })} />{role}</label>)}
            </div></fieldset>
            {users.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Individual approvers</legend><div className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
              {users.map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.approver_user_ids.includes(user.id)} onChange={(event) => updatePolicy(policy.action_key, { approver_user_ids: event.target.checked ? [...policy.approver_user_ids, user.id] : policy.approver_user_ids.filter((item) => item !== user.id) })} />{user.name} <span className="text-xs text-muted-foreground">({user.role})</span></label>)}
            </div></fieldset>}
          </div>}
          <div className="mt-3 flex justify-end"><Button size="sm" disabled={Boolean(busy)} onClick={() => void save(policy)}>{busy === policy.action_key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save rule</Button></div>
        </div>)}
        {!loading && policies.length === 0 && !error && <p className="text-sm text-muted-foreground">No approval policies are available. Apply database migration 167.</p>}
      </CardContent>
    </Card>
  </div>
}
