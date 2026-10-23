"use client"

import { useCallback, useEffect, useRef, useState, ChangeEvent } from "react"
import { Card } from "@/components/ui/card"
import { ArrowUpRight, Command, Loader2, Search, Sparkles, X } from "lucide-react"
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
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = useCallback(async () => {
    const value = query.trim()
    if (!value) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(value)}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Search failed")
      setResults(data.results || [])
      setSearched(true)
    } catch {
      setResults([])
      setSearched(true)
      setError("Search is temporarily unavailable. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim().length > 1) void doSearch() }, 350)
    return () => clearTimeout(t)
  }, [query, doSearch])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  const shortcuts = [
    { label: "Businesses", query: "MP-" },
    { label: "Partners", query: "partner" },
    { label: "Invoices", query: "INV-" },
    { label: "Leads", query: "lead" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-retail">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Search Control Centre</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Find businesses, leads, partners, invoices, payments and support records from one place.</p>
      </div>

      <Card className="rounded-2xl border-slate-200/80 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            className="h-12 w-full rounded-xl border border-transparent bg-slate-50 px-4 pl-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-retail/30 focus:bg-white focus:ring-4 focus:ring-retail/10"
            placeholder="Search by name, email, ID, invoice or ticket..."
            value={query}
            onChange={onChange}
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
          />
            {query && <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus() }} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>}
          </div>
          <button type="button" onClick={() => void doSearch()} disabled={loading || !query.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-retail px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-retail/90 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-3">
          <span className="mr-1 text-xs text-slate-400">Try searching:</span>
          {shortcuts.map((shortcut) => <button key={shortcut.label} type="button" onClick={() => { setQuery(shortcut.query); inputRef.current?.focus() }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-retail/30 hover:bg-retail-soft hover:text-retail">{shortcut.label}</button>)}
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-slate-400 lg:flex"><Command className="h-3 w-3" /> Enter to search</span>
        </div>
      </Card>

      {!searched && !loading && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:col-span-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-retail-soft text-retail"><Sparkles className="h-5 w-5" /></div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">One search for the whole operation</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">Use a business name, contact email, partner ID, invoice number or ticket subject. Results are grouped so you can open the right record quickly.</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Search tip</p>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">Start with at least two characters for the most useful results.</p>
          </div>
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {searched && !error && Object.keys(grouped).length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-4 text-base font-semibold text-slate-900">No records found</h2>
          <p className="mt-1 text-sm text-slate-500">Try a different name, ID, email or reference.</p>
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{results.length} result{results.length === 1 ? "" : "s"} for <span className="font-semibold text-slate-900">“{query.trim()}”</span></p></div>
          {Object.entries(grouped).map(([type, items]) => (
            <Card key={type} className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{type}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{items.length}</span></div>
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-retail">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{item.subtitle}</span></span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-retail" />
                      </Link>
                    </li>
                  ))}
                </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
