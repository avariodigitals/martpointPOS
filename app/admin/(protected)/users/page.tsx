"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Trash2, Users, Plus, User, Shield, Pencil, UserCheck, UserX } from "lucide-react"
import { ALL_ROLES, BUSINESS_UNITS, ROLE_DESCRIPTIONS, type BusinessUnit, type UserRole } from "@/lib/admin-types"
import { roleLabel } from "@/lib/utils"

type AdminUser = {
  id: string
  username: string
  email: string
  name: string
  signatureHtml: string
  role: UserRole
  roles: UserRole[]
  businessUnit: BusinessUnit | ""
  status: "ACTIVE" | "DISABLED"
  createdAt: string
}

const roles: UserRole[] = ALL_ROLES

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [businessUnitOpen, setBusinessUnitOpen] = useState(false)

  const emptyForm = {
    username: "",
    email: "",
    name: "",
    password: "",
    signatureHtml: "",
    role: "Editor" as AdminUser["role"],
    roles: ["Editor"] as UserRole[],
    businessUnit: "" as BusinessUnit | "",
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch {
      setMessage("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  async function parseResponse(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      console.error("Non-JSON response:", text.slice(0, 500))
      return { error: `Server error (${res.status}). Check console for details.` }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.roles.length || !form.businessUnit) {
      setMessage("Select at least one role and a Business Unit.")
      return
    }
    setSaving(true)
    setMessage("")

    try {
      if (editing) {
        const body: Record<string, unknown> = {
          id: editing.id,
          username: form.username,
          email: form.email,
          name: form.name,
          signatureHtml: form.signatureHtml,
          role: form.role,
          roles: form.roles,
          businessUnit: form.businessUnit,
        }
        if (form.password.trim()) body.password = form.password.trim()

        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await parseResponse(res)
        if (res.ok && data.success) {
          setMessage("User updated successfully.")
          resetForm()
          fetchUsers()
        } else {
          const errorMsg = (data.error as string) || `Failed to update user (${res.status}).`
          console.error("Update error:", errorMsg, data)
          setMessage(errorMsg)
        }
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            email: form.email,
            name: form.name,
            role: form.role,
            roles: form.roles,
            businessUnit: form.businessUnit,
            signatureHtml: form.signatureHtml,
          }),
        })
        const data = await parseResponse(res)
        if (res.ok && data.success) {
          setMessage("User created successfully.")
          resetForm()
          fetchUsers()
        } else {
          const errorMsg = (data.error as string) || `Failed to create user (${res.status}).`
          console.error("Create error:", errorMsg, data)
          setMessage(errorMsg)
        }
      }
    } catch (err) {
      console.error("Network or unexpected error:", err)
      setMessage("Network error. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this user? This cannot be undone.")) return
    setBusyUserId(id)
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" })
      const data = await parseResponse(res)
      if (res.ok && data.success) {
        setMessage("User permanently deleted.")
        fetchUsers()
      } else {
        const errorMsg = (data.error as string) || `Failed to delete user (${res.status}).`
        console.error("Delete error:", errorMsg, data)
        setMessage(errorMsg)
      }
    } catch (err) {
      console.error("Network or unexpected error:", err)
      setMessage("Network error. Check your connection and try again.")
    } finally {
      setBusyUserId(null)
    }
  }

  const handleStatusToggle = async (user: AdminUser) => {
    const status = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
    setBusyUserId(user.id)
    setMessage("")
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, status }),
      })
      const data = await parseResponse(res)
      if (!res.ok) throw new Error((data.error as string) || `Could not ${status === "ACTIVE" ? "reactivate" : "deactivate"} user.`)
      setMessage(status === "ACTIVE" ? "User reactivated." : "User deactivated.")
      await fetchUsers()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update user status.")
    } finally {
      setBusyUserId(null)
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setShowForm(false)
  }

  const startEdit = (user: AdminUser) => {
    setForm({
      username: user.username,
      email: user.email || "",
      name: user.name,
      password: "",
      signatureHtml: user.signatureHtml || "",
      role: user.role,
      roles: user.roles?.length ? user.roles : [user.role],
      businessUnit: user.businessUnit || "",
    })
    setEditing(user)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </h2>
          <p className="text-muted-foreground">Manage staff accounts, business units and combined departmental access.</p>
        </div>
        {!showForm && <div className="flex items-center gap-2">
          <Link href="/admin/users/roles" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Edit role permissions</Link>
          <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" />Add User</Button>
        </div>}
      </div>

      {message && (
        <p className={`text-sm ${/success|deleted|deactivated|reactivated/i.test(message) ? "text-success" : "text-destructive"}`}>
          {message}
        </p>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit User" : "New User"}</CardTitle>
            <CardDescription>
              {editing ? "Update user details and role." : "Create a new admin account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="johndoe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="name@example.com" required={!editing} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {editing ? "New Password (leave blank to keep current)" : "Password"}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder={editing ? "••••••••" : "Set by invitee from email link"}
                    {...(editing ? {} : { disabled: true })}
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">Roles <span className="text-muted-foreground font-normal">(select all that apply)</span></label>
                  <button type="button" onClick={() => setRolesOpen((open) => !open)} aria-expanded={rolesOpen} className="w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm">
                    {form.roles.length ? form.roles.map(roleLabel).join(", ") : "Select roles"}
                  </button>
                  {rolesOpen && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-lg">
                    {roles.map((r) => <label key={r} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
                      <input type="checkbox" checked={form.roles.includes(r)} onChange={(e) => {
                        const privileged = (role: UserRole) => role === "Admin" || role === "Super Admin"
                        const next = e.target.checked
                          ? privileged(r) || form.roles.some(privileged) ? [r] : [...form.roles, r]
                          : form.roles.filter((item) => item !== r)
                        if (!next.length) return
                        setForm({ ...form, roles: next, role: next[0] || "Editor" })
                      }} />
                      <span>{roleLabel(r)}</span>
                    </label>)}
                  </div>}
                  <p className="mt-1 text-xs text-muted-foreground">{form.roles.map((r) => ROLE_DESCRIPTIONS[r]).join(" · ")}</p>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">Business Unit</label>
                  <button type="button" aria-expanded={businessUnitOpen} onClick={() => setBusinessUnitOpen((open) => !open)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm">{form.businessUnit || "Select business unit"}</button>
                  {businessUnitOpen && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-lg">
                    {BUSINESS_UNITS.map((unit) => <button key={unit} type="button" onClick={() => { setForm({ ...form, businessUnit: unit }); setBusinessUnitOpen(false) }} className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted ${form.businessUnit === unit ? "bg-retail-soft font-medium text-retail" : ""}`}>{unit}</button>)}
                  </div>}
                  <p className="mt-1 text-xs text-muted-foreground">Choose the staff member’s home department. Selected roles combine access. Admin and Super Admin each grant full system access and are assigned alone.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Personal email signature (optional)</label>
                <textarea value={form.signatureHtml} onChange={(e) => setForm({ ...form, signatureHtml: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" rows={4} placeholder="<p><strong>Your Name</strong><br>MartPoint Sales</p>" />
                <p className="text-xs text-muted-foreground mt-1">Used when this user replies to leads. If empty, MartPoint Sales Team is used.</p>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {editing ? "Update User" : "Create User"}
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <Card key={user.id} className="relative">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-retail-soft flex items-center justify-center">
                      <User className="w-5 h-5 text-retail" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{user.name}</h3>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                      {user.email && <p className="text-xs text-muted-foreground truncate max-w-48">{user.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(user)}
                      disabled={busyUserId === user.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void handleStatusToggle(user)}
                      disabled={busyUserId === user.id}
                      className={`p-1.5 rounded-md transition-colors ${user.status === "ACTIVE" ? "text-muted-foreground hover:bg-amber-50 hover:text-amber-700" : "text-green-700 hover:bg-green-50"}`}
                      title={user.status === "ACTIVE" ? "Deactivate user" : "Reactivate user"}
                      aria-label={user.status === "ACTIVE" ? `Deactivate ${user.name}` : `Reactivate ${user.name}`}
                    >
                      {busyUserId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.status === "ACTIVE" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={busyUserId === user.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      {busyUserId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-retail" />
                  {(user.roles?.length ? user.roles : [user.role]).map((role) => <span key={role} className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.status === "ACTIVE" ? "text-retail bg-retail-soft" : "text-muted-foreground bg-muted"}`}>{roleLabel(role)}</span>)}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.status === "ACTIVE" ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"}`}>
                    {user.status === "ACTIVE" ? "Active" : "Deactivated"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {user.businessUnit && <span className="font-medium">{user.businessUnit} · </span>}{(user.roles?.length ? user.roles : [user.role]).map((role) => ROLE_DESCRIPTIONS[role]).join(" · ")}
                </p>
                {!user.roles?.includes("Admin") && !user.roles?.includes("Super Admin") && user.role !== "Admin" && <Link href={`/admin/users/${user.id}/permissions`} className="mt-2 inline-flex text-xs font-medium text-retail hover:underline">Personal permissions</Link>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
