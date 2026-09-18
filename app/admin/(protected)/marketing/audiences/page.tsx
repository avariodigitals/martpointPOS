"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"

interface Audience {
  id: string
  name: string
  description: string
  createdAt: string
  contactCount: number
}

interface Contact {
  id: string
  email: string
  name: string
}

export default function MarketingAudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newContacts, setNewContacts] = useState("")
  const [creating, setCreating] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [addEmails, setAddEmails] = useState("")
  const [adding, setAdding] = useState(false)
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set())

  const load = async () => {
    try {
      const res = await fetch("/api/admin/marketing/audiences")
      const data = await res.json()
      setAudiences(data.audiences || [])
    } catch {
      setMessage("Failed to load audiences")
    } finally {
      setLoading(false)
    }
  }

  const loadSuppressions = async () => {
    try {
      const res = await fetch("/api/admin/marketing/suppressions")
      const data = await res.json()
      setSuppressed(new Set((data.suppressions || []).map((s: { email: string }) => s.email)))
    } catch {
      setSuppressed(new Set())
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load()
      loadSuppressions()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/marketing/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDescription, contacts: newContacts }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(`Audience "${newName}" created with ${data.contactsAdded} contacts.`)
        setNewName("")
        setNewDescription("")
        setNewContacts("")
        load()
      } else {
        setMessage(data.error || "Failed to create audience")
      }
    } catch {
      setMessage("Failed to create audience")
    } finally {
      setCreating(false)
      setTimeout(() => setMessage(""), 5000)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setAddEmails("")
    setLoadingContacts(true)
    setContacts([])
    try {
      const res = await fetch(`/api/admin/marketing/audiences/${id}`)
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch {
      setMessage("Failed to load contacts")
    } finally {
      setLoadingContacts(false)
    }
  }

  const addContacts = async (id: string) => {
    if (!addEmails.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/admin/marketing/audiences/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: addEmails }),
      })
      const data = await res.json()
      if (data.success) {
        setAddEmails("")
        // reload contacts + counts
        const res2 = await fetch(`/api/admin/marketing/audiences/${id}`)
        const data2 = await res2.json()
        setContacts(data2.contacts || [])
        load()
      } else {
        setMessage(data.error || "Failed to add contacts")
      }
    } catch {
      setMessage("Failed to add contacts")
    } finally {
      setAdding(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const removeContact = async (audienceId: string, email: string) => {
    try {
      await fetch(`/api/admin/marketing/audiences/${audienceId}?contact=${encodeURIComponent(email)}`, { method: "DELETE" })
      setContacts((prev) => prev.filter((c) => c.email !== email))
      load()
    } catch {
      setMessage("Failed to remove contact")
    }
  }

  const deleteAudience = async (id: string, name: string) => {
    if (!confirm(`Delete audience "${name}" and all its contacts?`)) return
    try {
      await fetch(`/api/admin/marketing/audiences/${id}`, { method: "DELETE" })
      if (expandedId === id) setExpandedId(null)
      load()
    } catch {
      setMessage("Failed to delete audience")
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5" />
          Audiences
        </h2>
        <p className="text-muted-foreground">Reusable contact lists you can target in campaigns.</p>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted-foreground" />
            New Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Trade Fair Signups — Sept"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Where these contacts came from"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contacts (one per line or comma-separated — &quot;Name &lt;email&gt;&quot; works)</label>
            <textarea
              value={newContacts}
              onChange={(e) => setNewContacts(e.target.value)}
              rows={4}
              placeholder={"jane@example.com\nJohn Doe <john@example.com>"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y font-mono"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="retail" onClick={create} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              Create Audience
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Saved Audiences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audiences.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No audiences yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {audiences.map((a) => {
                const expanded = expandedId === a.id
                return (
                  <div key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      className="w-full text-left rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.description || "No description"} · created {new Date(a.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          <strong className="text-foreground">{a.contactCount}</strong> contacts
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border border-t-0 border-border rounded-b-lg bg-muted/10 p-4 space-y-3">
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => deleteAudience(a.id, a.name)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete Audience
                          </Button>
                        </div>
                        {loadingContacts ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading contacts…</p>
                        ) : (
                          <div className="space-y-1">
                            {contacts.map((c) => (
                              <div key={c.id} className="flex items-center justify-between text-xs rounded bg-background px-3 py-2">
                                <span className="truncate">
                                  {c.name ? <span className="font-medium">{c.name} — </span> : null}{c.email}
                                  {suppressed.has(c.email) && (
                                    <span className="ml-2 text-amber-600">unsubscribed</span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeContact(a.id, c.email)}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                  title="Remove contact"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium mb-1">Add contacts</label>
                          <div className="flex gap-2">
                            <textarea
                              value={addEmails}
                              onChange={(e) => setAddEmails(e.target.value)}
                              rows={2}
                              placeholder="email@example.com, Name <other@example.com>"
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
                            />
                            <Button size="sm" variant="outline" onClick={() => addContacts(a.id)} disabled={adding || !addEmails.trim()}>
                              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
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
