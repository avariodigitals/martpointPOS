"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"

export function AcknowledgeButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acknowledge() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/partner/documents/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(data.error || "Could not acknowledge")
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" onClick={acknowledge} disabled={busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
        Acknowledge
      </Button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  )
}
