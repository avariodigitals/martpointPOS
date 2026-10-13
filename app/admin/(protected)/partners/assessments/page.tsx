"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ClipboardCheck } from "lucide-react"
import { TierPanel } from "@/components/admin/partner-assessments/tier-panel"
import { TemplatePanel } from "@/components/admin/partner-assessments/template-panel"
import { AssignmentPanel } from "@/components/admin/partner-assessments/assignment-panel"
import type { AssessmentTier } from "@/lib/partner-assessments"

export default function PartnerAssessmentsAdminPage() {
  const [tab, setTab] = useState<"builder" | "assignments">("builder")
  const [tiers, setTiers] = useState<AssessmentTier[]>([])
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadTiers = useCallback(async () => {
    const res = await fetch("/api/admin/partner-assessments/tiers")
    const data = await res.json()
    const list = (data.tiers || []) as AssessmentTier[]
    setTiers(list)
    setSelectedTier((current) => {
      if (current && list.some((t) => t.id === current)) return current
      return list[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    loadTiers().finally(() => setLoading(false))
  }, [loadTiers])

  const tier = tiers.find((t) => t.id === selectedTier) ?? null

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6" /> Partner Assessments
          </h2>
          <p className="text-sm text-muted-foreground">
            Build timed knowledge papers by tier. Required tiers gate approval; every paper keeps its own pass and conditional bands.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("builder")}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === "builder" ? "bg-retail text-white" : "border border-border hover:bg-muted"}`}
          >
            Tiers and papers
          </button>
          <button
            onClick={() => setTab("assignments")}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === "assignments" ? "bg-retail text-white" : "border border-border hover:bg-muted"}`}
          >
            Assigned papers
          </button>
        </div>
      </div>

      {tab === "builder" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <TierPanel tiers={tiers} selectedId={selectedTier} onSelect={setSelectedTier} onChanged={loadTiers} />
          {tier ? (
            <TemplatePanel tier={tier} tierName={tier.name} onReload={loadTiers} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick a tier on the left to edit its papers.</p>
          )}
        </div>
      ) : (
        <AssignmentPanel />
      )}
    </div>
  )
}
