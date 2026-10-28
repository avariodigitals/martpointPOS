import { Suspense } from "react"
import SupportWorkspace from "@/components/admin/support-workspace"

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading support workspace…</p>}>
      <SupportWorkspace />
    </Suspense>
  )
}
