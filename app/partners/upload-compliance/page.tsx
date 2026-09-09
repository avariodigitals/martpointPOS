"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"

interface DocInfo {
  id: string
  document_type: string
  status: string
  reference: string
  applicantName: string
}

function UploadComplianceContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [doc, setDoc] = useState<DocInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Upload link is missing.")
      setLoading(false)
      return
    }

    fetch(`/api/partners/compliance-upload?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "This upload link is not valid.")
        } else {
          setDoc(data.doc)
        }
      })
      .catch(() => setError("Failed to load upload details."))
      .finally(() => setLoading(false))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !selectedFile) return
    if (selectedFile.size > 4 * 1024 * 1024) {
      setError("File is too large. Maximum size is 4 MB.")
      return
    }
    setUploading(true)
    setError("")

    const formData = new FormData()
    formData.append("token", token)
    formData.append("file", selectedFile)

    try {
      const res = await fetch("/api/partners/compliance-upload", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setDone(true)
      } else {
        setError(data.error || "Upload failed.")
      }
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Submit Compliance Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-medium">Document submitted successfully</p>
              <p className="text-sm text-muted-foreground">Thank you. The MartPoint team will review your submission and contact you if anything else is needed.</p>
            </div>
          ) : doc ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Application reference:</span> {doc.reference}</p>
                <p><span className="text-muted-foreground">Document requested:</span> {doc.document_type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Upload file</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">PDF, image, Word. Max 4 MB.</p>
              </div>
              <Button type="submit" disabled={uploading || !selectedFile} className="w-full">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Submit Document
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default function UploadCompliancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <UploadComplianceContent />
    </Suspense>
  )
}
