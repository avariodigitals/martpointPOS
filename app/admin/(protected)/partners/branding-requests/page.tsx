"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, UploadCloud } from "lucide-react"

interface BrandingRequest {
  id: string
  title: string
  description: string
  status: "PENDING" | "FULFILLED" | "DECLINED"
  partners: { business_name: string; display_name: string } | null
  created_at: string
  resource_id?: string | null
}

export default function PartnerBrandingRequestsAdminPage() {
  const [requests, setRequests] = useState<BrandingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [fulfilling, setFulfilling] = useState<Record<string, boolean>>({})

  async function fetchRequests() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/partner-branding-requests")
      const data = await res.json()
      setRequests((data.requests || []) as BrandingRequest[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests()
  }, [])

  async function fulfill(id: string) {
    const file = selectedFiles[id]
    if (!file) return
    setFulfilling((prev) => ({ ...prev, [id]: true }))
    setMessage("")
    try {
      const fd = new FormData()
      fd.append("requestId", id)
      fd.append("file", file)
      const res = await fetch("/api/admin/partner-branding-requests", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok) {
        setMessage("Request fulfilled and resource uploaded.")
        setSelectedFiles((prev) => { const n = { ...prev }; delete n[id]; return n })
        fetchRequests()
      } else {
        setMessage(data.error || "Failed to fulfill request.")
      }
    } finally {
      setFulfilling((prev) => ({ ...prev, [id]: false }))
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Branding Requests</h2>
        <p className="text-muted-foreground">Review and fulfill partner requests for branded materials.</p>
      </div>

      {message && <p className={`text-sm ${message.includes("fulfilled") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Pending Requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No branding requests yet.</p> : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="p-3 rounded-md border border-border bg-muted/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.partners?.display_name || r.partners?.business_name || "Unknown partner"} · {new Date(r.created_at).toLocaleDateString()} · {r.status}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                    </div>
                    {r.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.zip"
                          onChange={(e) => setSelectedFiles((prev) => ({ ...prev, [r.id]: e.target.files?.[0] as File }))}
                          className="text-xs w-40"
                        />
                        <Button size="sm" onClick={() => fulfill(r.id)} disabled={fulfilling[r.id] || !selectedFiles[r.id]}>
                          {fulfilling[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                          Fulfill
                        </Button>
                      </div>
                    )}
                  </div>
                  {r.status === "FULFILLED" && <p className="text-xs text-green-700 mt-2">Fulfilled with resource {r.resource_id}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
