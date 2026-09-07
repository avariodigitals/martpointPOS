"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, Download, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"

interface ComplianceDoc {
  id: string
  document_type: string
  verification_status: string
  uploaded_at: string
  original_filename: string
  signedUrl: string | null
  required: boolean
}

interface Score {
  score: number | null
  status: string
  label: string
  interpretation: string
}

export function PartnerComplianceClient({ documents, score }: { documents: ComplianceDoc[]; score: Score }) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})

  async function uploadDoc(docId: string) {
    const file = selectedFiles[docId]
    if (!file) return
    setUploading((prev) => ({ ...prev, [docId]: true }))
    setMessage("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("docId", docId)

      const res = await fetch("/api/partner/compliance", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setMessage("Document uploaded successfully. The MartPoint team will review it.")
        setSelectedFiles((prev) => ({ ...prev, [docId]: null }))
        router.refresh()
      } else {
        setMessage(data.error || "Failed to upload document.")
      }
    } finally {
      setUploading((prev) => ({ ...prev, [docId]: false }))
    }
  }

  const scoreColor = score.status === "COMPLIANT" ? "text-green-700" : score.status === "ATTENTION" ? "text-red-700" : "text-amber-700"
  const scoreBar = score.status === "COMPLIANT" ? "bg-green-600" : score.status === "ATTENTION" ? "bg-red-500" : "bg-amber-500"
  const displayScore = score.score === null ? 100 : score.score

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Compliance</h2>
        <p className="text-muted-foreground">Submit and track documents requested by MartPoint.</p>
      </div>

      {message && <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Compliance Score</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{score.label}</span>
            <span className={`font-semibold ${scoreColor}`}>{displayScore}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${scoreBar}`} style={{ width: `${displayScore}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{score.interpretation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Required Documents</CardTitle></CardHeader>
        <CardContent>
          {documents.filter((d) => d.required).length === 0 ? (
            <p className="text-sm text-muted-foreground">No compliance documents are required right now.</p>
          ) : (
            <div className="space-y-3">
              {documents.filter((d) => d.required).map((d) => (
                <ComplianceDocRow
                  key={d.id}
                  doc={d}
                  uploading={uploading[d.id] || false}
                  selectedFile={selectedFiles[d.id] || null}
                  onFileChange={(file) => setSelectedFiles((prev) => ({ ...prev, [d.id]: file }))}
                  onUpload={() => uploadDoc(d.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {documents.filter((d) => !d.required).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Other Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.filter((d) => !d.required).map((d) => (
                <ComplianceDocRow
                  key={d.id}
                  doc={d}
                  uploading={uploading[d.id] || false}
                  selectedFile={selectedFiles[d.id] || null}
                  onFileChange={(file) => setSelectedFiles((prev) => ({ ...prev, [d.id]: file }))}
                  onUpload={() => uploadDoc(d.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ComplianceDocRow({
  doc,
  uploading,
  selectedFile,
  onFileChange,
  onUpload,
}: {
  doc: ComplianceDoc
  uploading: boolean
  selectedFile: File | null
  onFileChange: (file: File | null) => void
  onUpload: () => void
}) {
  const isVerified = doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED"
  const isRejected = doc.verification_status === "REJECTED" || doc.verification_status === "EXPIRED"
  const isSubmitted = doc.verification_status === "SUBMITTED" || doc.verification_status === "UNDER_REVIEW"

  const icon = isVerified ? <CheckCircle className="w-5 h-5 text-green-600" /> :
               isRejected ? <XCircle className="w-5 h-5 text-red-600" /> :
               isSubmitted ? <Clock className="w-5 h-5 text-blue-600" /> :
               <AlertCircle className="w-5 h-5 text-amber-600" />

  const badgeColor = isVerified ? "bg-green-100 text-green-700" :
                     isRejected ? "bg-red-50 text-red-700" :
                     isSubmitted ? "bg-blue-50 text-blue-700" :
                     "bg-amber-50 text-amber-700"

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md border border-border bg-muted/10 gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium">{doc.document_type}</p>
          <p className="text-xs text-muted-foreground">
            {doc.original_filename || "Not submitted"} · {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "—"}
          </p>
          <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded-full font-medium mt-1 ${badgeColor}`}>{doc.verification_status}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {doc.signedUrl && (
          <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> View</Button>
          </a>
        )}
        {!isVerified && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              className="text-xs w-40"
            />
            <Button size="sm" onClick={onUpload} disabled={uploading || !selectedFile}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
