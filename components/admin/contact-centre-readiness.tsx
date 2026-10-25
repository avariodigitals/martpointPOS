"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
type Check = {
  id: string
  label: string
  status: string
  detail: string
  href?: string
}
export function ContactCentreReadiness() {
  const [checks, setChecks] = useState<Check[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/azera/readiness", {
          cache: "no-store",
        }),
        data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Could not check readiness")
      setChecks(data.checks)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Readiness check failed"
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    // This effect starts an external configuration check; the request owns its UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Contact-centre readiness</h2>
            <p className="text-sm text-muted-foreground">
              Configuration checks only—not proof of live delivery or a
              completed call.
            </p>
          </div>
          <button
            disabled={loading}
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Checking…" : "Recheck setup"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-blue-700">
            {checks.length
              ? `${checks.filter((check) => check.status !== "configured").length} setup items / limitations to review`
              : "View setup checks"}
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {checks.map((check) => (
              <section
                key={check.id}
                className="min-w-0 rounded-xl border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{check.label}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${check.status === "configured" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"}`}
                  >
                    {check.status === "configured"
                      ? "Configured · verify live"
                      : check.status === "blocked"
                        ? "Integration required"
                        : "Needs setup"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {check.detail}
                </p>
                {check.href && (
                  <Link
                    href={check.href}
                    className="mt-2 inline-block text-sm font-semibold text-blue-600 underline"
                  >
                    Open settings / reports
                  </Link>
                )}
              </section>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
