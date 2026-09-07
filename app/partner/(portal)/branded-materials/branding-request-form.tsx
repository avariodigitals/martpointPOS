"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Send } from "lucide-react"

export function BrandingRequestForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/branding-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Request submitted. The MartPoint team will review and upload the requested materials.")
        setTitle("")
        setDescription("")
        router.refresh()
      } else {
        setMessage(data.error || "Failed to submit request.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium">Request a Branding Asset</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <input
            placeholder="What do you need? (e.g. co-branded brochure, partner logo)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Describe the branding asset, size/format needed, and how it will be used."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={submitting} size="sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Request
          </Button>
          {message && <p className={`text-sm ${message.includes("submitted") ? "text-green-600" : "text-red-500"}`}>{message}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
