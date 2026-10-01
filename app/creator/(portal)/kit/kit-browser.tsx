"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Search, Download, ExternalLink, FileText, Image as ImageIcon,
  PlayCircle, Link2, FolderOpen, Loader2,
} from "lucide-react"
import { RESOURCE_CATEGORY_LABELS, type ResourceCategory, type ResourceType } from "@/lib/creator-constants"

interface Resource {
  id: string
  name: string
  description: string | null
  category: ResourceCategory
  resourceType: ResourceType
  version: string | null
  usageNotes: string | null
  downloadCount: number
  hasFile: boolean
  hasLink: boolean
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  FILE: FileText,
  IMAGE: ImageIcon,
  VIDEO: PlayCircle,
  ARTICLE: FileText,
  LINK: Link2,
}

export function KitBrowser({ resources }: { resources: Resource[] }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const categories = useMemo(
    () => [...new Set(resources.map((r) => r.category))],
    [resources]
  )

  const filtered = resources.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      (query.trim() === "" ||
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(query.toLowerCase()))
  )

  async function open(r: Resource, kind: "view" | "download") {
    setErr(null)
    setBusyId(r.id)
    const res = await fetch("/api/creator/resources/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: r.id, kind }),
    })
    const body = await res.json()
    setBusyId(null)
    if (body.error) {
      setErr(body.error)
      return
    }
    window.open(body.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources…"
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{RESOURCE_CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No resources match</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const Icon = TYPE_ICONS[r.resourceType] || FileText
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex gap-3">
                  <Icon className="h-8 w-8 text-retail shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                      {r.name}
                      {r.version && (
                        <span className="text-[10px] font-normal rounded-full bg-muted px-2 py-0.5">
                          v{r.version}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {RESOURCE_CATEGORY_LABELS[r.category] || r.category}
                    </p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.description}</p>
                    )}
                    {r.usageNotes && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">
                        {r.usageNotes}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {r.hasFile && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => open(r, "download")}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Download
                        </Button>
                      )}
                      {(r.hasLink || r.hasFile) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id}
                          onClick={() => open(r, "view")}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
