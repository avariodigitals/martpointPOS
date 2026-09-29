"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, AlertCircle } from "lucide-react"
import { formatKobo, type CareerVacancy } from "@/lib/careers"
import type { CareerCommission } from "@/lib/careers-commissions"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1.5"

const APPROVAL_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
}
const PAYMENT_COLORS: Record<string, string> = {
  EARNED: "bg-blue-50 text-blue-700",
  PAYABLE: "bg-indigo-50 text-indigo-700",
  PAID: "bg-green-50 text-green-700",
  REVERSED: "bg-gray-100 text-gray-500",
}

export default function CommissionsPage() {
  const [loading, setLoading] = useState(true)
  const [commissions, setCommissions] = useState<CareerCommission[]>([])
  const [vacancies, setVacancies] = useState<CareerVacancy[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [acting, setActing] = useState<string | null>(null)
  const [form, setForm] = useState({
    earner_label: "", vacancy_id: "", revenue_category: "", lead_source: "COMPANY_GENERATED",
    qualifying_amount: "", notes: "",
  })

  function load() {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/careers/commissions").then((r) => r.json()),
      fetch("/api/admin/careers/vacancies").then((r) => r.json()),
    ]).then(([c, v]) => {
      setCommissions(c.commissions || [])
      setVacancies((v.vacancies || []).filter((x: CareerVacancy) => x.commission_eligible))
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function record() {
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/admin/careers/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earner_label: form.earner_label,
          vacancy_id: form.vacancy_id || null,
          revenue_category: form.revenue_category,
          lead_source: form.lead_source,
          qualifying_amount_kobo: Math.round(Number(form.qualifying_amount) * 100),
          notes: form.notes || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Failed to record commission")
      setShowForm(false)
      setForm({ earner_label: "", vacancy_id: "", revenue_category: "", lead_source: "COMPANY_GENERATED", qualifying_amount: "", notes: "" })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record commission")
    } finally {
      setSaving(false)
    }
  }

  async function act(id: string, action: string) {
    setActing(id)
    setError("")
    try {
      const res = await fetch(`/api/admin/careers/commissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Action failed")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workforce Commissions</h2>
          <p className="text-muted-foreground">
            Commission is computed only from qualifying collected revenue. Taxes, refunds, logistics,
            reimbursable expenses and hardware are excluded unless management re-includes them.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><Plus className="w-4 h-4" /> Record commission</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Record earned commission</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Earner *</label>
              <input className={inputCls} value={form.earner_label} onChange={(e) => setForm((p) => ({ ...p, earner_label: e.target.value }))} placeholder="Worker or agent name" />
            </div>
            <div>
              <label className={labelCls}>Vacancy (supplies commission rules)</label>
              <select className={inputCls} value={form.vacancy_id} onChange={(e) => setForm((p) => ({ ...p, vacancy_id: e.target.value }))}>
                <option value="">None</option>
                {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Revenue category *</label>
              <input className={inputCls} value={form.revenue_category} onChange={(e) => setForm((p) => ({ ...p, revenue_category: e.target.value }))} placeholder="e.g. Subscription" />
            </div>
            <div>
              <label className={labelCls}>Lead source</label>
              <select className={inputCls} value={form.lead_source} onChange={(e) => setForm((p) => ({ ...p, lead_source: e.target.value }))}>
                <option value="COMPANY_GENERATED">Company-generated</option>
                <option value="SELF_GENERATED">Self-generated</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Collected amount (₦) *</label>
              <input type="number" min={0} className={inputCls} value={form.qualifying_amount} onChange={(e) => setForm((p) => ({ ...p, qualifying_amount: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <Button onClick={record} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Compute &amp; record
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : commissions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No commission records yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Earner</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Lead source</th>
                  <th className="py-3 px-4">Qualifying</th>
                  <th className="py-3 px-4">Commission</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="py-3 px-4 font-medium">{c.earner_label}</td>
                    <td className="py-3 px-4 text-xs">{c.revenue_category}</td>
                    <td className="py-3 px-4 text-xs">{c.lead_source === "SELF_GENERATED" ? "Self" : "Company"}</td>
                    <td className="py-3 px-4 text-xs">{formatKobo(c.qualifying_amount_kobo)}</td>
                    <td className="py-3 px-4 font-medium">
                      {formatKobo(c.amount_kobo)}
                      {c.rate != null && <span className="text-xs text-muted-foreground"> ({c.rate}%)</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_COLORS[c.approval_status] || ""}`}>{c.approval_status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLORS[c.payment_status] || ""}`}>{c.payment_status}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      <div>Earned {new Date(c.earned_at).toLocaleDateString()}</div>
                      {c.paid_at && <div>Paid {new Date(c.paid_at).toLocaleDateString()}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {c.approval_status === "PENDING" && (
                          <>
                            <Button size="sm" variant="outline" disabled={acting === c.id} onClick={() => act(c.id, "approve")}>Approve</Button>
                            <Button size="sm" variant="outline" disabled={acting === c.id} onClick={() => act(c.id, "reject")}>Reject</Button>
                          </>
                        )}
                        {c.approval_status === "APPROVED" && c.payment_status !== "PAID" && c.payment_status !== "REVERSED" && (
                          <Button size="sm" variant="outline" disabled={acting === c.id} onClick={() => act(c.id, "pay")}>Mark paid</Button>
                        )}
                        {c.payment_status === "EARNED" && (
                          <Button size="sm" variant="outline" disabled={acting === c.id} onClick={() => act(c.id, "mark_payable")}>Mark payable</Button>
                        )}
                        {c.payment_status !== "REVERSED" && c.approval_status !== "REJECTED" && (
                          <Button size="sm" variant="outline" disabled={acting === c.id}
                            onClick={() => { if (confirm("Reverse this commission (e.g. refunded payment)?")) act(c.id, "reverse") }}>
                            Reverse
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
