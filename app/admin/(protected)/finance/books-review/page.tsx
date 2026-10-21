"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"

type Finding = {
  code: string
  severity: "critical" | "warning" | "info"
  title: string
  detail: string
  count: number
  samples?: string[]
}

type Metrics = {
  period_start: string
  revenue_invoiced: number
  cash_collected: number
  expenses_total: number
  net_result: number
  gross_cash: number
  receivables_owed: number
  vat_payable_balance: number
  avg_monthly_net: number
  runway_months: number | null
  overdue_invoices: { count: number; amount: number }
  top_customers: { name: string; amount: number; share: number }[]
}

type Narrative = {
  executive_summary: string
  sustainability: string
  compliance_posture: string[]
  red_flags: string[]
  cash_and_runway: string
  revenue_quality: string
  recommended_actions: string[]
  investor_readiness: string
}

type Review = {
  id: string
  status: string
  months: number
  model: string | null
  health_score: number | null
  verdict: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  metrics: Metrics | null
  findings: Finding[] | null
  narrative: Narrative | null
}

const ngn = (n: number | null | undefined) =>
  `₦${(Number(n) || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`

const SEVERITY_STYLE: Record<Finding["severity"], string> = {
  critical: "border-red-300 bg-red-50",
  warning: "border-amber-300 bg-amber-50",
  info: "border-sky-200 bg-sky-50",
}

const VERDICT_STYLE: Record<string, string> = {
  HEALTHY: "bg-green-100 text-green-800",
  WATCH: "bg-amber-100 text-amber-800",
  ATTENTION: "bg-red-100 text-red-800",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}

export default function BooksReviewPage() {
  const { toast } = useToast()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [rederiving, setRederiving] = useState(false)
  const [months, setMonths] = useState(12)

  const load = useCallback(() => {
    return fetch("/api/admin/finance/books-review")
      .then((res) => res.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runReview() {
    setRunning(true)
    try {
      const res = await fetch("/api/admin/finance/books-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      })
      const d = await res.json()
      toast(
        res.ok
          ? { title: "Books review completed", variant: "success" }
          : { title: "Books review failed", description: d.error, variant: "error" },
      )
      if (res.ok) await load()
    } finally {
      setRunning(false)
    }
  }

  async function rederiveIncome() {
    if (!window.confirm("Re-build every invoice's income rows and journal entry from its line items (subscriptions, add-ons, services, products and logistics booked separately)? This is run once after migration 091.")) return
    setRederiving(true)
    try {
      const res = await fetch("/api/admin/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "rederive-income" }),
      })
      const d = await res.json()
      toast(
        res.ok
          ? { title: `Income re-derived for ${d.data?.invoices_processed ?? 0} invoice(s)`, variant: "success" }
          : { title: "Re-derive failed", description: d.error, variant: "error" },
      )
      if (res.ok) await load()
    } finally {
      setRederiving(false)
    }
  }

  const latest = reviews[0]

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-retail" /> Books Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated integrity checks over our own books plus an investor-grade report. Figures are computed
            from the ledger; the AI only narrates them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
          <Button variant="outline" onClick={rederiveIncome} disabled={rederiving}>
            {rederiving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Re-split invoice income
          </Button>
          <Button onClick={runReview} disabled={running}>
            {running && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {latest ? "Start new review" : "Start first review"}
          </Button>
        </div>
      </div>

      {!latest ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reviews yet. Start the first review to check the ledger and generate the report.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Latest review */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-3xl font-bold">
              {latest.health_score ?? "—"}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            {latest.verdict && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${VERDICT_STYLE[latest.verdict] || "bg-muted"}`}>
                {latest.verdict}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(latest.created_at).toLocaleString("en-NG")} · last {latest.months} months
            </span>
            {latest.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = `/api/admin/finance/books-review/pdf?id=${latest.id}`
                }}
              >
                <Download className="w-4 h-4 mr-1" /> Download PDF report
              </Button>
            )}
          </div>

          {latest.status === "FAILED" && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="py-4 text-sm">
                Last review failed: {latest.error_message || "unknown error"}. The checks below still ran where data allowed.
              </CardContent>
            </Card>
          )}

          {latest.metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Key figures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Revenue invoiced" value={ngn(latest.metrics.revenue_invoiced)} />
                  <Stat label="Cash collected" value={ngn(latest.metrics.cash_collected)} />
                  <Stat label="Expenses" value={ngn(latest.metrics.expenses_total)} />
                  <Stat label="Net result" value={ngn(latest.metrics.net_result)} />
                  <Stat label="Gross cash / bank" value={ngn(latest.metrics.gross_cash)} />
                  <Stat label="Receivables owed" value={ngn(latest.metrics.receivables_owed)} />
                  <Stat label="VAT payable balance" value={ngn(latest.metrics.vat_payable_balance)} />
                  <Stat
                    label="Runway"
                    value={latest.metrics.runway_months != null ? `${latest.metrics.runway_months} mo` : "Not burning"}
                  />
                  <Stat
                    label="Overdue invoices"
                    value={`${latest.metrics.overdue_invoices.count} (${ngn(latest.metrics.overdue_invoices.amount)})`}
                  />
                  <Stat label="Avg monthly net (3mo)" value={ngn(latest.metrics.avg_monthly_net)} />
                  {latest.metrics.top_customers?.[0] && (
                    <Stat
                      label="Largest customer"
                      value={`${latest.metrics.top_customers[0].name} · ${latest.metrics.top_customers[0].share}%`}
                    />
                  )}
                  <Stat label="Period" value={latest.metrics.period_start} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Automated integrity findings{" "}
                <span className="font-normal text-muted-foreground">
                  ({latest.findings?.length ? `${latest.findings.length} issue group(s)` : "all clear"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!latest.findings || latest.findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All checks passed: balanced journal, ledger coverage, VAT plausibility, duplicate payments, cash
                  signs and receivables reconciliation.
                </p>
              ) : (
                latest.findings.map((f) => (
                  <div key={f.code} className={`rounded-lg border-l-4 p-3 ${SEVERITY_STYLE[f.severity]}`}>
                    <p className="text-sm font-semibold">
                      {f.title} <span className="text-xs font-normal text-muted-foreground">×{f.count}</span>
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground">{f.detail}</p>
                    {f.samples && f.samples.length > 0 && (
                      <p className="text-[11px] mt-1 font-mono text-muted-foreground">{f.samples.join(" · ")}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {latest.narrative && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Executive summary <span className="font-normal text-muted-foreground text-xs">(AI narrative over computed figures)</span></CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{latest.narrative.executive_summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Sustainability</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{latest.narrative.sustainability}</p></CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Investor readiness</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed">{latest.narrative.investor_readiness}</p></CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Compliance posture</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1.5 list-disc pl-4">
                    {latest.narrative.compliance_posture.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Red flags</CardTitle></CardHeader>
                <CardContent>
                  {latest.narrative.red_flags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None raised beyond the automated findings.</p>
                  ) : (
                    <ul className="text-sm space-y-1.5 list-disc pl-4">
                      {latest.narrative.red_flags.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Cash & runway</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{latest.narrative.cash_and_runway}</p>
                  <p className="text-sm leading-relaxed mt-2">{latest.narrative.revenue_quality}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Recommended actions</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1.5 list-disc pl-4">
                    {latest.narrative.recommended_actions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* History */}
      {reviews.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Review history</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-4">Reviewed at</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Verdict</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {reviews.slice(1).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString("en-NG")}</td>
                    <td className="py-2 pr-4">{r.months} mo</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">{r.health_score ?? "—"}</td>
                    <td className="py-2 pr-4">{r.verdict || "—"}</td>
                    <td className="py-2 text-right">
                      {r.status === "COMPLETED" && (
                        <a
                          className="text-retail underline text-xs"
                          href={`/api/admin/finance/books-review/pdf?id=${r.id}`}
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
