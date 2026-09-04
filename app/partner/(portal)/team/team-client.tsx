"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, UserX, UserCheck, Mail, User, Loader2 } from "lucide-react"
import {
  PARTNER_USER_ROLES,
  PARTNER_ROLE_LABELS,
  type PartnerUserRole,
  partnerUserHasPermission,
} from "@/lib/partner-permissions"

interface PartnerUser {
  id: string
  fullName: string
  email: string
  role: PartnerUserRole
  status: string
  invitedAt: string | null
  lastLoginAt: string | null
}

interface Invitation {
  id: string
  email: string
  role: PartnerUserRole
  fullName: string | null
  full_name: string | null
  accepted_at: string | null
  revoked_at: string | null
  expires_at: string
}

export function PartnerTeamClient({
  currentRole,
  users,
  invitations,
}: {
  currentRole: PartnerUserRole
  users: PartnerUser[]
  invitations: Invitation[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fullName: "", email: "", role: "PARTNER_MANAGER" as PartnerUserRole })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const canManage = partnerUserHasPermission(currentRole, "partner:users:manage")
  const canInvite = partnerUserHasPermission(currentRole, "partner:users:invite")

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Invitation sent.")
        setForm({ fullName: "", email: "", role: "PARTNER_MANAGER" })
        setShowForm(false)
        router.refresh()
      } else {
        setMessage(data.error || "Failed to invite user.")
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(userId: string, status: string) {
    const res = await fetch(`/api/partner/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (res.ok) router.refresh()
    else setMessage(data.error || "Failed to update user.")
  }

  async function resend(invitationId: string) {
    const res = await fetch(`/api/partner/invitations/${invitationId}`, { method: "PATCH" })
    const data = await res.json()
    if (res.ok) { setMessage("Invitation resent."); router.refresh() }
    else setMessage(data.error || "Failed to resend invitation.")
  }

  async function revoke(invitationId: string) {
    const res = await fetch(`/api/partner/invitations/${invitationId}`, { method: "DELETE" })
    const data = await res.json()
    if (res.ok) { setMessage("Invitation revoked."); router.refresh() }
    else setMessage(data.error || "Failed to revoke invitation.")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground">Manage users in your organisation.</p>
        </div>
        {canInvite && !showForm && (
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Invite User</Button>
        )}
      </div>

      {message && <p className={`text-sm ${message.includes("sent") || message.includes("resent") || message.includes("revoked") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      {showForm && canInvite && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Invite Team Member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={invite} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Full Name</label>
                  <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PartnerUserRole })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {PARTNER_USER_ROLES.map((r) => <option key={r} value={r}>{PARTNER_ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invitation"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Users</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? <p className="text-sm text-muted-foreground">No users yet.</p> : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-retail-soft flex items-center justify-center text-retail font-bold text-sm"><User className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">{u.email} · {u.role.replace("PARTNER_", "")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-medium ${u.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{u.status}</span>
                    {canManage && u.status === "ACTIVE" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(u.id, "SUSPENDED")}><UserX className="w-3.5 h-3.5" /></Button>
                    )}
                    {canManage && u.status === "SUSPENDED" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(u.id, "ACTIVE")}><UserCheck className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Pending Invitations</CardTitle></CardHeader>
        <CardContent>
          {invitations.filter((i) => !i.accepted_at && !i.revoked_at).length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p> : (
            <div className="space-y-2">
              {invitations
                .filter((i) => !i.accepted_at && !i.revoked_at)
                .map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                  <div>
                    <p className="text-sm font-medium">{i.fullName || i.full_name || i.email}</p>
                    <p className="text-xs text-muted-foreground">{i.email} · {i.role.replace("PARTNER_", "")} · Expires {new Date(i.expires_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canInvite && (
                      <Button size="sm" variant="outline" onClick={() => resend(i.id)}><Mail className="w-3.5 h-3.5 mr-1" /> Resend</Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => revoke(i.id)}><UserX className="w-3.5 h-3.5 mr-1" /> Revoke</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
