"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Search, AlertCircle, CheckCircle2 } from "lucide-react"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"

const inputCls = "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"

interface Result {
  application: {
    reference: string
    vacancyTitle: string | null
    submittedAt: string
    statusLabel: string
  }
}

export function StatusLookup() {
  const [reference, setReference] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })

  const lookup = async () => {
    if (!reference.trim() || !email.trim()) {
      setError("Both your application reference and email are required.")
      return
    }
    setLoading(true)
    setError("")
    setResult(null)
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setLoading(false)
      setError("Please complete the security check.")
      return
    }
    try {
      const res = await fetch("/api/careers/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference.trim(), email: email.trim(), captchaToken }),
      })
      const data = await res.json()
      if (res.ok && data.application) {
        setResult(data)
      } else {
        setError(data.error || "No application found for those details.")
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
          <label className="block text-sm font-medium mb-1.5">Application Reference</label>
          <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MPC-2026-XXXXXX" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email used to apply</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />
        <Button onClick={lookup} disabled={loading} variant="retail" className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Check Status
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-muted/10 p-5 space-y-3 text-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <CheckCircle2 className="w-4 h-4 text-retail" />
            <span className="font-semibold text-foreground">{result.application.reference}</span>
          </div>
          {result.application.vacancyTitle && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Vacancy</span>
              <span className="font-medium text-foreground text-right">{result.application.vacancyTitle}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Submitted</span>
            <span className="font-medium text-foreground">
              {new Date(result.application.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-muted-foreground">Status</span>
            <span className="inline-flex items-center rounded-full bg-retail-soft px-3 py-1 text-xs font-semibold text-retail">
              {result.application.statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            This is a simplified status. Our team will contact you directly if your application progresses.
          </p>
        </div>
      )}
    </div>
  )
}
