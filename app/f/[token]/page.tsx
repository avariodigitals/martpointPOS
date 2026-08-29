"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Star, AlertCircle, Check, ThumbsUp, ThumbsDown } from "lucide-react"

const STEPS = ["deployment", "configuration", "testing", "training", "handover"]

type Customer = {
  fullName: string
  businessName: string
  productInterest: string
  feedback: Record<string, unknown>
}

export default function CustomerFeedbackPage() {
  const params = useParams()
  const token = params.token as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [mood, setMood] = useState<"pleased" | "neutral" | "unhappy">("neutral")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/customer-feedback?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.customer) {
          setCustomer(data.customer)
          const saved = (data.customer.feedback?.ratings as Record<string, number>) || {}
          setRatings({
            deployment: 0,
            configuration: 0,
            testing: 0,
            training: 0,
            handover: 0,
            ...saved,
          })
          setComment((data.customer.feedback?.comment as string) || "")
          setMood((data.customer.feedback?.mood as "pleased" | "neutral" | "unhappy") || "neutral")
        } else {
          setError(data.error || "Link not found")
        }
      })
      .catch(() => setError("Failed to load feedback form"))
      .finally(() => setLoading(false))
  }, [token])

  const setRating = (step: string, value: number) => {
    setRatings((prev) => ({ ...prev, [step]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/customer-feedback?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings, comment, mood }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || "Submission failed")
      }
    } catch {
      setError("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Link not available</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Thank You</h2>
          <p className="text-sm text-muted-foreground">
            Your feedback has been recorded. We use it to keep improving your experience.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="w-6 h-6 text-retail" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">How is everything going?</h1>
          <p className="mt-2 text-muted-foreground">
            Hi {customer?.fullName}, rate every step of your MartPoint {customer?.productInterest === "erp" ? "ERP" : "Retail"} setup.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-retail" />
            Rate each step
          </h2>

          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-sm font-medium capitalize">{step}</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(step, n)}
                      className="p-1 focus:outline-none"
                      aria-label={`${n} star`}
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          n <= (ratings[step] || 0)
                            ? "text-amber-500 fill-amber-500"
                            : "text-gray-300 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">How are you feeling overall?</label>
            <div className="flex items-center gap-2">
              {[
                { value: "pleased" as const, label: "Pleased", icon: ThumbsUp, color: "text-green-700 bg-green-50 border-green-200" },
                { value: "neutral" as const, label: "Neutral", icon: Star, color: "text-amber-700 bg-amber-50 border-amber-200" },
                { value: "unhappy" as const, label: "Unhappy", icon: ThumbsDown, color: "text-red-700 bg-red-50 border-red-200" },
              ].map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                      mood === m.value ? m.color : "text-muted-foreground bg-background border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Comments (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 resize-none"
              placeholder="Tell us what went well or what we can improve..."
            />
          </div>

          <Button
            size="lg"
            variant="retail"
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || STEPS.some((s) => !ratings[s])}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {customer?.businessName} · MartPoint Customer Feedback
        </p>
      </div>
    </div>
  )
}
