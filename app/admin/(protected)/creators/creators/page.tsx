"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface CreatorRow {
  id: string
  creatorId: string
  referralCode: string
  fullName: string
  email: string
  state: string | null
  primaryCategory: string | null
  status: string
  levelLabel: string | null
  activatedAt: string | null
  createdAt: string
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING_ACTIVATION: "bg-amber-100 text-amber-700",
  SUSPENDED: "bg-red-100 text-red-700",
  REMOVED: "bg-muted text-muted-foreground",
}

export default function AdminCreatorsPage() {
  const [loading, setLoading] = useState(true)
  const [creators, setCreators] = useState<CreatorRow[]>([])
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (q) params.set("q", q)
    fetch(`/api/admin/creators/creators?${params}`)
      .then((r) => r.json())
      .then((d) => setCreators(d.creators || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, q])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Creators</h2>
        <p className="text-muted-foreground">Approved Creator Network members.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, code…"
            className="rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm w-72"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_ACTIVATION">Pending Activation</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : creators.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No creators yet.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-4">Creator</th>
                  <th className="p-4">Codes</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">State</th>
                  <th className="p-4">Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4">
                      <p className="font-medium">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {c.creatorId}<br />
                      <span className="text-muted-foreground">{c.referralCode}</span>
                    </td>
                    <td className="p-4 text-xs">{c.primaryCategory || "—"}</td>
                    <td className="p-4 text-xs">{c.state || "—"}</td>
                    <td className="p-4 text-xs">{c.levelLabel || "Starter"}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.status] || "bg-muted"}`}>
                        {enumLabel(c.status)}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.activatedAt || c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="p-4">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/creators/creators/${c.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
