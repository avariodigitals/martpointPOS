"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react"

interface ComplianceRecord {
  id: string
  requirement_type: string
  status: "NOT_REQUIRED" | "REQUESTED" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  requested_at?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  reviewer_name?: string | null
  expires_at?: string | null
  public_note?: string | null
  document_path?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  NOT_REQUIRED: "bg-gray-100 text-gray-700",
  REQUESTED: "bg-amber-100 text-amber-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-700",
  VERIFIED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-700",
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

export default function BusinessCompliancePage() {
  const { businessId } = useParams() as { businessId: string }
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!businessId) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/compliance?business=${businessId}`)
        const data = await res.json()
        if (data.success) {
          setRecords((data.records || []) as ComplianceRecord[])
        } else {
          setMessage(data.error || "Failed to load compliance records")
        }
      } catch {
        setMessage("Failed to load compliance records")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/businesses/${businessId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Business
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Compliance · {businessId}
        </h2>
      </div>

      {message && <p className="text-sm text-red-500">{message}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Compliance Records</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No compliance records for this business.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Requirement</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Requested</th>
                    <th className="px-4 py-2">Submitted</th>
                    <th className="px-4 py-2">Reviewed</th>
                    <th className="px-4 py-2">Expires</th>
                    <th className="px-4 py-2">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{r.requirement_type}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{fmtDate(r.requested_at)}</td>
                      <td className="px-4 py-2">{fmtDate(r.submitted_at)}</td>
                      <td className="px-4 py-2">{r.reviewer_name ? `${r.reviewer_name} · ${fmtDate(r.reviewed_at)}` : "—"}</td>
                      <td className="px-4 py-2">{fmtDate(r.expires_at)}</td>
                      <td className="px-4 py-2">
                        {r.document_path ? (
                          <a href={r.document_path} target="_blank" rel="noopener noreferrer" className="text-retail hover:underline text-xs">View</a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
