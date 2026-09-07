"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, Mail, AlertCircle, Check } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "The sign-in link is incomplete. Please request a new one.",
  invalid_or_expired_link: "This sign-in link is invalid or has expired. Please request a new one.",
}

export default function CustomerSupportLoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [devLink, setDevLink] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("error")
    if (code && ERROR_MESSAGES[code]) setError(ERROR_MESSAGES[code])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setDevLink("")
    setLoading(true)

    try {
      const res = await fetch("/api/support/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(true)
        if (json.devLink) setDevLink(json.devLink)
      } else {
        setError(json.error || "Request failed")
      }
    } catch {
      setError("Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
            <LifeBuoy className="w-6 h-6 text-retail" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Customer Support</h1>
          <p className="mt-2 text-muted-foreground">
            View and manage support tickets for your business.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  If <span className="font-medium text-foreground">{email}</span> is registered for a
                  MartPoint business, we have sent a sign-in link. The link expires in 15 minutes.
                </p>
              </div>
              {devLink && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                  <p className="text-xs font-medium text-amber-800 mb-1">Dev mode (Resend not configured):</p>
                  <a href={devLink} className="text-xs text-amber-700 underline break-all">
                    {devLink}
                  </a>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuccess(false)
                  setEmail("")
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Business email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your-business@email.com"
                    className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Use the primary email registered for your business. We will email you a secure sign-in link.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" size="lg" variant="retail" className="w-full" disabled={loading || !email.trim()}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Email me a sign-in link
              </Button>
            </form>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Prefer to reach us another way?{" "}
              <a href="https://wa.me/+2348036028069?text=Hi%2C%20I%20need%20support%20with%20MartPoint" className="text-retail hover:underline" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              {" "}or{" "}
              <a href="mailto:hello@martpoint.com.ng" className="text-retail hover:underline">email</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
