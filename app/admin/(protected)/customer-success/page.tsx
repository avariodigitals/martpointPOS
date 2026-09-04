"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, HeartHandshake } from "lucide-react"
import type { CustomerStage, CustomerHealth, HealthSignals } from "@/lib/customer-success"

interface Profile {
  id: string
  business_id: string
  business_name: string | null
  owner_admin_user_id: string | null
  owner_name: string | null
  stage: CustomerStage
  health: CustomerHealth
  last_contact_at: string | null
  next_follow_up_at: string | null
  last_training_at: string | null
  notes_summary: string | null
  signals?: HealthSignals
}

const STAGES: CustomerStage[] = ["ONBOARDING", "LIVE", "ADOPTION", "AT_RISK", "RENEWAL", "CHURNED"]
const HEALTHS: CustomerHealth[] = ["HEALTHY", "WATCH", "AT_RISK", "CRITICAL"]

const STAGE_COLORS: Record<CustomerStage, string> = {
  ONBOARDING: "bg-blue-100 text-blue-700",
  LIVE: "bg-green-100 text-green-700",
  ADOPTION: "bg-indigo-100 text-indigo-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  RENEWAL: "bg-violet-100 text-violet-700",
  CHURNED: "bg-gray-100 text-gray-700",
}

const HEALTH_COLORS: Record<CustomerHealth, string> = {
  HEALTHY: "bg-green-100 text-green-700",
  WATCH: "bg-amber-100 text-amber-700",
  AT_RISK: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

export default function CustomerSuccessPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [stageFilter, setStageFilter] = useState<string>("")
  const [healthFilter, setHealthFilter] = useState<string>("")
  const [ownerFilter, setOwnerFilter] = useState<string>("")

  useEffect(() => {
    fetchProfiles()
  }, [])

  async function fetchProfiles() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/customer-success")
      const data = await res.json()
      if (data.success && data.profiles) {
        setProfiles(data.profiles as Profile[])
      } else {
        setMessage(data.error || "Failed to load profiles")
      }
    } catch {
      setMessage("Failed to load profiles")
    } finally {
      setLoading(false)
    }
  }

  const owners = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of profiles) {
      if (p.owner_admin_user_id && p.owner_name) {
        map.set(p.owner_admin_user_id, p.owner_name)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [profiles])

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (stageFilter && p.stage !== stageFilter) return false
      if (healthFilter && p.health !== healthFilter) return false
      if (ownerFilter && p.owner_admin_user_id !== ownerFilter) return false
      return true
    })
  }, [profiles, stageFilter, healthFilter, ownerFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HeartHandshake className="w-5 h-5" />
          Customer Success
        </h2>
        <p className="text-muted-foreground">Monitor customer health, stages and follow-ups.</p>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">Stage</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Health</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="">All health</option>
            {HEALTHS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Owner</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProfiles}>Refresh</Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Customer Success Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No profiles match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Business</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2">Stage</th>
                    <th className="px-4 py-2">Health</th>
                    <th className="px-4 py-2">Open Tickets</th>
                    <th className="px-4 py-2">Renewal</th>
                    <th className="px-4 py-2">Last Contact</th>
                    <th className="px-4 py-2">Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <Link href={`/admin/businesses/${p.business_id}`} className="font-medium hover:underline">
                          {p.business_name || "Unnamed"}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{p.owner_name || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STAGE_COLORS[p.stage]}`}>
                          {p.stage}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${HEALTH_COLORS[p.health]}`}>
                          {p.health}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.signals?.open_tickets ?? "—"}</td>
                      <td className="px-4 py-2">{p.signals?.renewal_approaching ? "Approaching" : "—"}</td>
                      <td className="px-4 py-2">{fmtDate(p.last_contact_at)}</td>
                      <td className="px-4 py-2">{fmtDate(p.next_follow_up_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
