"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, GripVertical, Loader2, Save } from "lucide-react"

interface FAQ {
  id: string
  question: string
  answer: string
}

export default function AdminFAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/faqs")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.faqs) setFaqs(data.faqs)
      })
      .catch(() => {
        if (!cancelled) setMessage("Failed to load FAQs")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("FAQs saved successfully!")
      } else {
        setMessage(data.error || "Failed to save FAQs")
      }
    } catch {
      setMessage("Failed to save FAQs")
    } finally {
      setSaving(false)
    }
  }

  function addFaq() {
    const newFaq: FAQ = {
      id: `faq-${Date.now()}`,
      question: "",
      answer: "",
    }
    setFaqs([...faqs, newFaq])
  }

  function updateFaq(index: number, field: keyof FAQ, value: string) {
    const updated = [...faqs]
    updated[index] = { ...updated[index], [field]: value }
    setFaqs(updated)
  }

  function removeFaq(index: number) {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  function moveFaq(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === faqs.length - 1) return
    const updated = [...faqs]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    ;[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]]
    setFaqs(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-retail" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage FAQs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, and reorder frequently asked questions. These appear on the public FAQs page.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="default">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.includes("success")
              ? "bg-success/10 text-success border border-success/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <Card key={faq.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  FAQ #{index + 1}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveFaq(index, "up")}
                    disabled={index === 0}
                  >
                    <GripVertical className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeFaq(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Question</label>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFaq(index, "question", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What is MartPoint?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Answer</label>
                <textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, "answer", e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Enter a detailed answer..."
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={addFaq} variant="outline" className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add New FAQ
      </Button>

      {faqs.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground mb-4">No FAQs yet.</p>
          <Button onClick={addFaq} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add your first FAQ
          </Button>
        </div>
      )}
    </div>
  )
}
