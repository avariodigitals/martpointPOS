"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { enumLabel } from "@/lib/utils"
import { Search, Link2 } from "lucide-react"

interface KbLink {
  id: string
  title: string
  description: string | null
  url: string
  category: string
}

export function KbLinks({ links }: { links: KbLink[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(
    () =>
      links.filter(
        (l) =>
          query.trim() === "" ||
          l.title.toLowerCase().includes(query.toLowerCase()) ||
          (l.description || "").toLowerCase().includes(query.toLowerCase())
      ),
    [links, query]
  )

  const byCategory = new Map<string, KbLink[]>()
  for (const l of filtered) {
    if (!byCategory.has(l.category)) byCategory.set(l.category, [])
    byCategory.get(l.category)!.push(l)
  }

  function track(id: string) {
    void fetch("/api/creator/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "KB_LINK_OPENED", entityType: "kb_link", entityId: id }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help topics…"
          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nothing matches — try the full{" "}
            <a href="/help-centre" target="_blank" rel="noopener noreferrer" className="text-retail underline">
              Help Centre
            </a>.
          </CardContent>
        </Card>
      ) : (
        [...byCategory.entries()].map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">
              {enumLabel(cat)}
            </p>
            <Card>
              <CardContent className="divide-y p-0">
                {items.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track(l.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <Link2 className="h-4 w-4 text-retail shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.title}</p>
                      {l.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
                      )}
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  )
}
