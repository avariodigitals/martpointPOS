"use client"
import { useEffect, useState } from "react"
import { Loader2, Search, Check } from "lucide-react"
import type { RequesterType, SupportRequester } from "@/lib/support-requester"

export function SupportRequesterPicker({
  value,
  onChange
}: {
  value: SupportRequester | null
  onChange: (value: SupportRequester | null) => void
}) {
  const [type, setType] = useState<RequesterType>(value?.type || "lead")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<SupportRequester[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(
          `/api/admin/support/requesters?type=${type}&search=${encodeURIComponent(search)}`,
          { signal: controller.signal }
        )
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error || "Could not search contacts")
        setResults(data.data || [])
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Could not search contacts")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [type, search])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {(["lead", "business", "partner", "creator"] as const).map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => {
              setType(item)
              onChange(null)
            }}
            className={`rounded-md px-3 py-1.5 text-xs capitalize ${type === item ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {value ? (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{value.name}</p>
            <p className="break-all text-xs text-muted-foreground">{value.email || "No email on profile"}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-xs underline">
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Find requester"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Find a ${type} by name or email`}
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-lg border">
            {loading ? (
              <div className="flex justify-center p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : results.length ? (
              results.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => onChange(row)}
                  className="block w-full border-b border-border p-2.5 text-left last:border-0 hover:bg-muted"
                >
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email || "No email on profile"}</p>
                </button>
              ))
            ) : (
              <p className="p-3 text-xs text-muted-foreground">{error || "No matching profiles."}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
