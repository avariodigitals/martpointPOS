"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Star, Download } from "lucide-react"

interface ReviewRequest {
  id: string
  business_id: string
  conversation_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  channel: string
  status: string
  review_rating: number | null
  review_text: string | null
  review_link: string | null
  sent_at: string | null
  reviewed_at: string | null
  created_at: string
}

export default function GoogleReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReviews()
  }, [])

  async function loadReviews() {
    try {
      const res = await fetch("/api/azera/google-reviews")
      const json = await res.json()
      if (json.data) {
        setReviews(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    sent: "bg-blue-50 text-blue-700",
    delivered: "bg-indigo-50 text-indigo-700",
    reviewed: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Star className="w-5 h-5" />
          Google Reviews
        </h1>
        <p className="text-muted-foreground">
          Manage Google review requests sent to customers via WhatsApp, SMS, or
          Email. Configure your Google Place ID in
          <span className="font-medium">Admin → Settings → Integrations → Google Reviews</span>.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Star className="w-10 h-10 opacity-20 mx-auto mb-3" />
          <p className="text-sm">No review requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Channel</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Rating</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {r.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate">
                    {r.customer_name || r.customer_phone || r.customer_email || "Unknown"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-[10px] tracking-wider px-1.5 py-0.5 rounded font-medium bg-muted`}
                    >
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[r.status] || "bg-gray-100"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.review_rating ? "★".repeat(r.review_rating) : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.review_link && (
                      <a
                        href={r.review_link}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-retail hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Open
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
