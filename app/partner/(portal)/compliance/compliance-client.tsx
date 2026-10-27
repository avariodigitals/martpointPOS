"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, Download, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { enumLabel } from "@/lib/utils"

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
  const [bankFields, setBankFields] = useState<Record<string, { bankName: string; accountName: string; accountNumber: string }>>({})

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

  async function submitBankDetails(docId: string) {
    setUploading((prev) => ({ ...prev, [docId]: true }))
    setMessage("")
    try {
      const res = await fetch("/api/partner/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, ...(bankFields[docId] || {}) }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage(data.error || "Could not submit bank details."); return }
      setMessage("Bank details submitted securely. The MartPoint team will review them.")
      setBankFields((prev) => ({ ...prev, [docId]: { bankName: "", accountName: "", accountNumber: "" } }))
      router.refresh()
    } catch {
      setMessage("Could not submit bank details. Please try again.")
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
                  bankFields={bankFields[d.id] || { bankName: "", accountName: "", accountNumber: "" }}
                  onFileChange={(file) => setSelectedFiles((prev) => ({ ...prev, [d.id]: file }))}
                  onBankFieldChange={(field, value) => setBankFields((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] || { bankName: "", accountName: "", accountNumber: "" }), [field]: value } }))}
                  onUpload={() => uploadDoc(d.id)}
                  onSubmitBank={() => submitBankDetails(d.id)}
                  saving={uploading[d.id] || false}
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
                  bankFields={bankFields[d.id] || { bankName: "", accountName: "", accountNumber: "" }}
                  onFileChange={(file) => setSelectedFiles((prev) => ({ ...prev, [d.id]: file }))}
                  onBankFieldChange={(field, value) => setBankFields((prev) => ({ ...prev, [d.id]: { ...(prev[d.id] || { bankName: "", accountName: "", accountNumber: "" }), [field]: value } }))}
                  onUpload={() => uploadDoc(d.id)}
                  onSubmitBank={() => submitBankDetails(d.id)}
                  saving={uploading[d.id] || false}
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
  bankFields,
  onBankFieldChange,
  onSubmitBank,
  saving,
}: {
  doc: ComplianceDoc
  uploading: boolean
  selectedFile: File | null
  onFileChange: (file: File | null) => void
  onUpload: () => void
  bankFields: { bankName: string; accountName: string; accountNumber: string }
  onBankFieldChange: (field: "bankName" | "accountName" | "accountNumber", value: string) => void
  onSubmitBank: () => void
  saving: boolean
}) {
  const isVerified = doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED"
  const isRejected = doc.verification_status === "REJECTED" || doc.verification_status === "EXPIRED"
  const isSubmitted = doc.verification_status === "SUBMITTED" || doc.verification_status === "UNDER_REVIEW"
  const isBankDetails = /bank/i.test(doc.document_type)

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
          <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded-full font-medium mt-1 ${badgeColor}`}>{enumLabel(doc.verification_status)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full sm:w-auto">
        {doc.signedUrl && (
          <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> View</Button>
          </a>
        )}
        {isBankDetails && !isVerified && (!isSubmitted || isRejected) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:min-w-[440px]">
            <input aria-label="Bank name" placeholder="Bank name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={bankFields.bankName} onChange={(e) => onBankFieldChange("bankName", e.target.value)} />
            <input aria-label="Account holder name" placeholder="Account holder name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={bankFields.accountName} onChange={(e) => onBankFieldChange("accountName", e.target.value)} />
            <input aria-label="Account number" inputMode="numeric" autoComplete="off" placeholder="Account number" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={bankFields.accountNumber} onChange={(e) => onBankFieldChange("accountNumber", e.target.value.replace(/[^\d ]/g, ""))} />
            <Button size="sm" onClick={onSubmitBank} disabled={saving || bankFields.bankName.trim().length < 2 || bankFields.accountName.trim().length < 2 || bankFields.accountNumber.replace(/\D/g, "").length < 9}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit bank details"}
            </Button>
            <p className="sm:col-span-2 text-xs text-muted-foreground">Enter the details here; no document upload is needed. Details are sent securely for MartPoint review.</p>
          </div>
        ) : !isBankDetails && !isVerified && (
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
