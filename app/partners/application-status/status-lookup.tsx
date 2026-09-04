"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Check, X, AlertCircle } from "lucide-react"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

interface Result {
  application: {
    reference: string
    partnerType: string
    status: string
    statusLabel: string
    submittedAt: string
    updatedAt: string
    requiredAction: string | null
    rejected: boolean
    active: boolean
  }
  progress: { label: string; reached: boolean }[]
}

export function ApplicationStatusLookup() {
  const [reference, setReference] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)

  const lookup = async () => {
    if (!reference.trim() || !email.trim()) {
      setError("Both reference number and email are required.")
      return
    }
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/partners/application-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.application) {
        setResult(data)
      } else {
        setError(data.error || "Lookup failed.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 md:p-8 space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Application Reference</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MPA-2026-00001" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email used to apply</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <Button onClick={lookup} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Check Status
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
            <Row label="Reference" value={result.application.reference} />
            <Row label="Partner type" value={result.application.partnerType} />
            <Row label="Submitted" value={new Date(result.application.submittedAt).toLocaleDateString()} />
            <Row label="Last updated" value={new Date(result.application.updatedAt).toLocaleDateString()} />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground">Status:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                result.application.active ? "bg-green-50 text-green-700"
                : result.application.rejected ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700"
              }`}>
                {result.application.active ? <Check className="w-3 h-3" /> : result.application.rejected ? <X className="w-3 h-3" /> : null}
                {result.application.statusLabel}
              </span>
            </div>
          </div>

          {result.application.requiredAction && (
            <div className={`rounded-md p-3 text-sm ${result.application.rejected ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
              <p className="font-medium mb-1">{result.application.rejected ? "Outcome" : "Required action"}</p>
              <p>{result.application.requiredAction}</p>
            </div>
          )}

          {/* Progress */}
          <div>
            <p className="text-sm font-medium mb-3">Progress</p>
            <div className="space-y-2">
              {result.progress.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${p.reached ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    {p.reached ? <Check className="w-3 h-3" /> : null}
                  </div>
                  <span className={`text-sm ${p.reached ? "text-foreground font-medium" : "text-muted-foreground"}`}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
