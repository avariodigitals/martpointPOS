"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Trash2, Users, Plus, User, Shield, Pencil } from "lucide-react"

interface AdminUser {
  id: string
  username: string
  name: string
  role: "Admin" | "Sales" | "Tech" | "Editor"
  createdAt: string
}

const roles: AdminUser["role"][] = ["Admin", "Sales", "Tech", "Editor"]

const roleDescriptions: Record<string, string> = {
  Admin: "Full access to all admin features",
  Sales: "Tracker & analytics only",
  Tech: "Settings, SEO, Blog & FAQs",
  Editor: "Blog & FAQs content only",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const emptyForm = {
    username: "",
    name: "",
    password: "",
    role: "Editor" as AdminUser["role"],
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
    setSaving(true)
    setMessage("")

    try {
      if (editing) {
        const body: Record<string, unknown> = {
          id: editing.id,
          username: form.username,
          name: form.name,
          role: form.role,
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
            password: form.password,
            name: form.name,
            role: form.role,
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
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" })
      const data = await parseResponse(res)
      if (res.ok && data.success) {
        setMessage("User deleted.")
        fetchUsers()
      } else {
        const errorMsg = (data.error as string) || `Failed to delete user (${res.status}).`
        console.error("Delete error:", errorMsg, data)
        setMessage(errorMsg)
      }
    } catch (err) {
      console.error("Network or unexpected error:", err)
      setMessage("Network error. Check your connection and try again.")
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
      name: user.name,
      password: "",
      role: user.role,
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
          <p className="text-muted-foreground">Manage admin users and assign roles.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") || message.includes("deleted") ? "text-success" : "text-destructive"}`}>
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
                    placeholder={editing ? "••••••••" : "Create a password"}
                    {...(!editing && { required: true })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as AdminUser["role"] })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{roleDescriptions[form.role]}</p>
                </div>
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
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(user)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-retail" />
                  <span className="text-xs font-medium text-retail bg-retail-soft px-2 py-0.5 rounded-full">
                    {user.role}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {roleDescriptions[user.role]}
                </p>
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
