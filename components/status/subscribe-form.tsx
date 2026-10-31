"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CaptchaField, type CaptchaFieldHandle } from "@/components/captcha-field"
import { Bell, CheckCircle2, Loader2 } from "lucide-react"

export function StatusSubscribeForm() {
  const [email, setEmail] = useState("")
  const [newsletter, setNewsletter] = useState(false)
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const captchaRef = useRef<CaptchaFieldHandle>(null)

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    setState("loading")
    setError("")
    try {
      const captchaToken = await captchaRef.current?.execute()
      const res = await fetch("/api/status/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newsletter, captchaToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setState("done")
      } else {
        setError(data.error || "Something went wrong. Please try again.")
        setState("error")
      }
    } catch {
      setError("Network error. Please try again.")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
        <CheckCircle2 className="w-4 h-4" />
        You&apos;re subscribed to status and maintenance updates{newsletter ? " and the MartPoint product newsletter" : ""}.
      </p>
    )
  }

  return (
    <form onSubmit={subscribe} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
      />
      <CaptchaField ref={captchaRef} onChange={() => {}} />
      <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground sm:max-w-56">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-1 accent-blue-600" />
        Also email me MartPoint product news and newsletters.
      </label>
      <Button type="submit" disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Bell className="w-4 h-4 mr-2" />
        )}
        Subscribe to Updates
      </Button>
      {state === "error" && error && (
        <p className="text-sm text-red-600 sm:ml-2">{error}</p>
      )}
    </form>
  )
}
