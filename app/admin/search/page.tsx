"use client"

import { useEffect, useState, ChangeEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"
import Link from "next/link"

type Result = {
  type: string
  id: string
  title: string
  subtitle: string
  href: string
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.success ? data.results : [])
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => { if (query.length > 1) doSearch() }, 300)
    return () => clearTimeout(t)
  }, [query])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Global Search</h2>
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm"
            placeholder="Search businesses, leads, partners, invoices, payments, tickets..."
            value={query}
            onChange={onChange}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
        </div>
        <Button onClick={doSearch} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}</Button>
      </div>

      {Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, items]) => (
            <Card key={type}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{type}</p>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="text-sm text-retail hover:underline block">
                        {item.title} <span className="text-muted-foreground text-xs">{item.subtitle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
