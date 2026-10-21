"use client"

import { Button } from "@/components/ui/button"
import { Eye, ExternalLink } from "lucide-react"

interface PreviewModalProps {
  open: boolean
  onClose: () => void
  previewUrl: string | null
  type: "agreement" | "schedule"
}
export function InstrumentsPreviewModal({ open, onClose, previewUrl, type }: PreviewModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-lg border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Eye className="h-5 w-5" />
            Review {type === "agreement" ? "Partner Agreement" : "Commission Schedule"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">Close</Button>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-md border bg-muted">
          {previewUrl ? (
            <iframe src={previewUrl} title="Generated document preview" className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Unable to load preview. Please check the document status.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {previewUrl && (
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open PDF
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
