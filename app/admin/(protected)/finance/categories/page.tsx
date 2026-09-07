"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, Pencil, X, Check, Tag, Landmark } from "lucide-react"
import Link from "next/link"

interface FinanceCategory {
  id: string
  type: "expense" | "income"
  name: string
  active: boolean
  sort_order: number
}

const TABS = ["expense", "income"] as const

export default function FinanceCategoriesPage() {
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense")

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/finance/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories)
      })
      .catch(() => setMessage("Failed to load categories"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return categories
      .filter((c) => c.type === activeTab)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
  }, [categories, activeTab])

  const openAdd = () => {
    setEditing(null)
    setName("")
    setShowForm(true)
  }

  const openEdit = (cat: FinanceCategory) => {
    setEditing(cat)
    setName(cat.name)
    setShowForm(true)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage("Category name is required")
      return
    }
    setSaving(true)
    setMessage("")
    try {
      const url = "/api/admin/finance/categories"
      const method = editing ? "PUT" : "POST"
      const body = editing
        ? JSON.stringify({ id: editing.id, name: trimmed })
        : JSON.stringify({ type: activeTab, name: trimmed })
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body })
      const data = await res.json()
      if (data.success && data.category) {
        setCategories((prev) => {
          if (editing) {
            return prev.map((c) => (c.id === editing.id ? data.category : c))
          }
          return [...prev, data.category]
        })
        setShowForm(false)
      } else {
        setMessage(data.error || "Failed to save category")
      }
    } catch {
      setMessage("Failed to save category")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (cat: FinanceCategory) => {
    try {
      const res = await fetch("/api/admin/finance/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, active: !cat.active }),
      })
      const data = await res.json()
      if (data.success && data.category) {
        setCategories((prev) => prev.map((c) => (c.id === cat.id ? data.category : c)))
      } else {
        setMessage(data.error || "Failed to update category")
      }
    } catch {
      setMessage("Failed to update category")
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this category? It will not affect existing transactions.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/finance/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
      } else {
        setMessage(data.error || "Failed to delete category")
      }
    } catch {
      setMessage("Failed to delete category")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Finance Categories
          </h2>
          <p className="text-muted-foreground">Manage expense and income categories used across transactions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/transactions">Transactions</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/finance">Finance Dashboard</Link>
          </Button>
        </div>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-md ${message.includes("saved") || message.includes("delete") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-retail text-retail"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "expense" ? "Expense Categories" : "Income Categories"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="w-4 h-4" />
            {activeTab === "expense" ? "Expense Categories" : "Income Categories"}
          </CardTitle>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No {activeTab} categories found.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(cat)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        cat.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                      title={cat.active ? "Active" : "Inactive"}
                    >
                      {cat.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {cat.active ? "Active" : "Inactive"}
                    </button>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(cat.id)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      {deletingId === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${activeTab === "expense" ? "Office Supplies" : "Consulting Revenue"}`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {editing ? "Save Changes" : "Add Category"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
