"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileText, CheckCircle, Home } from "lucide-react"
import { allIndustries } from "@/lib/industries"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"

interface Brochure {
  id: string
  title: string
  description: string
}

interface BrochureDownloadFormProps {
  brochure: Brochure | null
}

const businessTypes = [...allIndustries.map((i) => i.name), "Other"]

export function BrochureDownloadForm({ brochure }: BrochureDownloadFormProps) {
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    businessType: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [submitted, setSubmitted] = useState(false)

  const router = useRouter()

  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(() => router.push("/"), 2000)
    return () => clearTimeout(timer)
  }, [submitted, router])

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (
      !form.fullName.trim() ||
      !form.businessName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.businessType
    ) {
      setError("Please complete all fields.")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address.")
      return
    }

    setSubmitting(true)
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setSubmitting(false)
      setError("Please complete the security check before submitting.")
      return
    }
    try {
      const res = await fetch("/api/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          captchaToken: captchaToken || undefined,
          source: "brochure",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlock download")
      }

      setSignedUrl(data.signedUrl)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const download = () => {
    if (!signedUrl) return
    window.open(signedUrl, "_blank")
  }

  if (!brochure) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Brochure Coming Soon
        </h1>
        <p className="mt-4 text-muted-foreground">
          We are updating our brochure. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {brochure.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {brochure.description}
        </p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-success/20 bg-success/5 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-success" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Thank you!</h3>
          <p className="text-muted-foreground mb-6">
            Your download is ready. Redirecting to home in 2 seconds...
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={download}>
              <Download className="w-4 h-4 mr-2" /> Download Brochure
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/")}
            >
              <Home className="w-4 h-4 mr-2" /> Go Home Now
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-6 bg-card rounded-2xl border border-border p-6 md:p-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="Your Business Ltd"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="you@business.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="+234 80x xxx xxxx"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Business Type *
            </label>
            <select
              value={form.businessType}
              onChange={(e) => update("businessType", e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              <option value="">Select business type</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              "Unlock Download"
            )}
          </Button>
        </form>
      )}
    </div>
  )
}
