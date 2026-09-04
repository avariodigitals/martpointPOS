"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, FileText, Download } from "lucide-react"

interface ComplianceDoc {
  id: string
  document_type: string
  verification_status: string
  uploaded_at: string
  original_filename: string
  signedUrl: string | null
}

const DOCUMENT_TYPES = [
  "Certificate of Incorporation",
  "Tax Clearance Certificate",
  "Identification Document",
  "Proof of Address",
  "Bank Account Confirmation",
  "Other",
]

export function PartnerComplianceClient({ documents }: { documents: ComplianceDoc[] }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    setMessage("")
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("documentType", documentType)

      const res = await fetch("/api/partner/compliance", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Document uploaded successfully.")
        setSelectedFile(null)
        router.refresh()
      } else {
        setMessage(data.error || "Failed to upload document.")
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Compliance</h2>
        <p className="text-muted-foreground">Submit documents requested by MartPoint. All documents are reviewed internally.</p>
      </div>

      {message && <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Upload Document</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={upload} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium mb-1">Document Type</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">File</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
            <Button type="submit" disabled={uploading || !selectedFile}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Submit Document
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Submitted Documents</CardTitle></CardHeader>
        <CardContent>
          {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents submitted yet.</p> : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{d.document_type}</p>
                      <p className="text-xs text-muted-foreground">{d.original_filename || "—"} · {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-medium ${
                      d.verification_status === "VERIFIED" ? "bg-green-50 text-green-700" :
                      d.verification_status === "REJECTED" ? "bg-red-50 text-red-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>{d.verification_status}</span>
                    {d.signedUrl && (
                      <a href={d.signedUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> View</Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
