"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Search, AlertCircle } from "lucide-react"

export function VerifyPartnerClient() {
  const router = useRouter()
  const [partnerId, setPartnerId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const verify = () => {
    const id = partnerId.trim().toUpperCase()
    if (!id) { setError("Enter a Partner ID."); return }
    if (!/^MP-[A-Z]{2,3}-\d{1,6}$/i.test(id)) { setError("Partner ID format: MP-NG-00001"); return }
    setError("")
    setLoading(true)
    router.push(`/partners/${id}`)
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 md:p-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Partner ID</label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          placeholder="MP-NG-00001"
        />
      </div>
      {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
      <Button onClick={verify} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        Verify Partner
      </Button>
      <p className="text-xs text-muted-foreground text-center">You can also search by business name in the <a href="/partners/directory" className="text-retail hover:underline">partner directory</a>.</p>
    </div>
  )
}
