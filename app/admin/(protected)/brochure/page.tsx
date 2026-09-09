"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, UploadCloud, Download, FileText } from "lucide-react"

interface ResourceItem {
  title: string
  signedUrl: string
}

export default function AdminBrochurePage() {
  const [resource, setResource] = useState<ResourceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetchResource()
  }, [])

  async function fetchResource() {
    try {
      const res = await fetch("/api/admin/brochure")
      const data = await res.json()
      if (data.resource) {
        setResource({
          title: data.resource.title as string,
          signedUrl: data.resource.signedUrl as string,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setMessage("")

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch("/api/admin/brochure", {
        method: "POST",
        body: fd,
      })
      const data = await res.json()

      if (res.ok && data.resource) {
        setResource({
          title: data.resource.title,
          signedUrl: data.resource.signedUrl,
        })
        setFile(null)
        setMessage("Brochure replaced successfully.")
      } else {
        setMessage(data.error || "Upload failed.")
      }
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Brochure</h2>
        <p className="text-muted-foreground">
          Upload the current product brochure. The file will be available on the
          public download page after a visitor fills in their details.
        </p>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.includes("success")
              ? "text-green-600"
              : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}

      {resource && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Current Brochure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{resource.title}</p>
                <a
                href={resource.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex mt-2"
              >
                <Button size="sm" variant="outline">
                  <Download className="w-3.5 h-3.5 mr-1" /> View / Download
                </Button>
              </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Replace Brochure</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={upload} className="space-y-4">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" /> Replace Brochure
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
