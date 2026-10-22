"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Clock3, FileText, Loader2, Plus, Send, Trash2, X } from "lucide-react"
import { enumLabel } from "@/lib/utils"
import { formatMoney } from "@/lib/money-format"
import { quoteTemplateOptions, resolveQuoteTemplate } from "@/lib/quote-templates"

type Tab = "requests" | "create"

type Lead = {
  id?: string
  business_name?: string
  contact_name?: string
  email?: string
  phone?: string
  industry?: string
  business_type?: string
  city?: string
  state?: string
  status?: string
}

type QuoteRequest = {
  id: string
  partner_id: string
  partner_lead_id: string
  plan_id?: string | null
  plan_name?: string | null
  locations?: string | null
  users_estimate?: string | null
  services_requested?: string | null
  assumptions?: string | null
  notes?: string | null
  due_date?: string | null
  status: string
  issued_quote_ref?: string | null
  created_at: string
  partners?: { business_name?: string; partner_id?: string } | null
  partner_leads?: Lead | null
}

type CatalogItem = {
  id: string
  name: string
  description?: string | null
  price: number
  currency: string
  item_type: "PRODUCT" | "PLAN" | "SERVICE" | "ADDON"
}

type Plan = { id: string; name: string; code?: string; base_price: number; currency?: string; active?: boolean }

type QuoteLine = {
  item_type: "PRODUCT" | "PLAN" | "SERVICE" | "ADDON" | "CUSTOM"
  reference_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  tax_rate: number | null
}

const emptyLine = (): QuoteLine => ({
  item_type: "CUSTOM",
  reference_id: null,
  description: "",
  quantity: 1,
  unit_price: 0,
  discount: 0,
  tax: 0,
  tax_rate: 0,
})

function datePlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function requestLabel(request: QuoteRequest) {
  return `${request.partner_leads?.business_name || "Opportunity"} · ${request.plan_name || "Plan pending"}`
}

function statusClass(status: string) {
  if (status === "ISSUED") return "bg-emerald-50 text-emerald-700"
  if (status === "DECLINED" || status === "EXPIRED") return "bg-red-50 text-red-700"
  if (status === "UNDER_REVIEW") return "bg-amber-50 text-amber-700"
  return "bg-blue-50 text-blue-700"
}

export default function PartnerQuotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "create" ? "create" : "requests")
  const [requests, setRequests] = useState<QuoteRequest[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [taxRates, setTaxRates] = useState<{ name: string; rate: number }[]>([])
  const [bankDetails, setBankDetails] = useState("")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedRequestId, setSelectedRequestId] = useState("")
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    planId: "",
    currency: "NGN",
    validUntil: datePlus(14),
    templateIndustry: "",
    publicNotes: "",
    paymentTerms: "",
    internalNotes: "",
  })
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()])

  const selectedRequest = requests.find((r) => r.id === selectedRequestId) || null
  const openRequests = requests.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status))
  const totals = useMemo(() => lines.reduce((acc, line) => {
    const net = Math.max(0, (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) - (Number(line.discount) || 0))
    const tax = line.tax_rate == null ? Number(line.tax) || 0 : net * (Number(line.tax_rate) || 0) / 100
    acc.subtotal += (Number(line.quantity) || 0) * (Number(line.unit_price) || 0)
    acc.discount += Number(line.discount) || 0
    acc.tax += tax
    acc.total += Math.max(0, net + tax)
    return acc
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [lines])

  useEffect(() => {
    void loadWorkspace()
  }, [])

  async function loadWorkspace() {
    setLoading(true)
    try {
      const [requestRes, planRes, catalogRes, quotationRes, settingsRes] = await Promise.all([
        fetch("/api/admin/partner-quote-requests"),
        fetch("/api/admin/finance/catalog?type=plans&activeOnly=true"),
        fetch("/api/admin/finance/catalog?type=all&activeOnly=true"),
        fetch("/api/admin/quotations"),
        fetch("/api/admin/settings"),
      ])
      const requestData = await requestRes.json()
      const planData = await planRes.json()
      const catalogData = await catalogRes.json()
      const quotationData = await quotationRes.json()
      const settingsData = await settingsRes.json()
      setRequests(requestData.requests || [])
      const planRows = Array.isArray(planData.data) ? planData.data : planData.data?.plans || []
      setPlans(planRows.filter((p: Plan) => p.active !== false))
      const all = catalogData.data || {}
      const rows: CatalogItem[] = [
        ...(all.products || []).map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name), description: p.description as string | null, price: Number(p.default_price) || 0, currency: String(p.currency || "NGN"), item_type: "PRODUCT" as const })),
        ...(all.plans || []).map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name), description: p.description as string | null, price: Number(p.base_price) || 0, currency: String(p.currency || "NGN"), item_type: "PLAN" as const })),
        ...(all.services || []).map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name), description: p.description as string | null, price: Number(p.default_price) || 0, currency: String(p.currency || "NGN"), item_type: "SERVICE" as const })),
        ...(all.addons || []).map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name), description: p.description as string | null, price: Number(p.default_price) || 0, currency: String(p.currency || "NGN"), item_type: "ADDON" as const })),
      ]
      setCatalog(rows.sort((a, b) => a.name.localeCompare(b.name)))
      setTaxRates((quotationData.taxRates || []).map((t: Record<string, unknown>) => ({ name: String(t.name), rate: Number(t.rate) || 0 })))
      setBankDetails(String(settingsData.general?.accountNumber || ""))
    } catch {
      setMessage("Some quote data could not be loaded. Refresh and try again.")
    } finally {
      setLoading(false)
    }
  }

  function switchTab(next: Tab) {
    setTab(next)
    router.replace(`/admin/partners/quotes?tab=${next}`)
  }

  function applyTemplate(industry: string, keepPlan = true) {
    const template = resolveQuoteTemplate(industry || null)
    setForm((prev) => ({ ...prev, templateIndustry: industry, publicNotes: template.publicNotes, paymentTerms: template.paymentTerms, ...(keepPlan ? {} : { planId: "" }) }))
  }

  function chooseRequest(requestId: string) {
    const request = requests.find((r) => r.id === requestId)
    setSelectedRequestId(requestId)
    if (!request) return
    const planId = request.plan_id || plans.find((p) => p.name === request.plan_name)?.id || ""
    setForm((prev) => ({ ...prev, planId }))
    const industry = request.partner_leads?.industry || request.partner_leads?.business_type || ""
    applyTemplate(industry)
    const plan = plans.find((p) => p.id === planId)
    if (plan) setLines((prev) => [{ ...emptyLine(), item_type: "PLAN", reference_id: plan.id, description: plan.name, quantity: 1, unit_price: Number(plan.base_price) || 0 }, ...prev.filter((line) => line.description.trim())])
  }

  function updateLine(index: number, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((line, i) => i === index ? { ...line, ...patch } : line))
  }

  function pickCatalog(index: number, id: string) {
    const item = catalog.find((c) => c.id === id)
    if (!item) {
      updateLine(index, { reference_id: null, item_type: "CUSTOM" })
      return
    }
    updateLine(index, { reference_id: item.id, item_type: item.item_type, description: item.description ? `${item.name}\n${item.description}` : item.name, unit_price: item.price })
    setForm((prev) => ({ ...prev, currency: item.currency || prev.currency }))
  }

  async function decide(requestId: string, decision: "UNDER_REVIEW" | "DECLINED" | "ISSUED", quoteRef?: string) {
    setWorking(true)
    setMessage("")
    const body = { quoteRequestId: requestId, decision, issuedQuoteRef: quoteRef || undefined, decisionReason: decisionNotes[requestId] || undefined }
    const res = await fetch("/api/admin/partner-quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    setWorking(false)
    if (!data.success) return setMessage(data.error || "The quote request could not be updated.")
    setMessage(decision === "ISSUED" ? "Quote issued to the partner." : `Request marked ${enumLabel(decision)}.`)
    await loadWorkspace()
  }

  async function createQuote(issueNow: boolean) {
    if (!selectedRequest) return setMessage("Select a quote request first.")
    if (!form.planId) return setMessage("Select an active plan.")
    const validLines = lines.filter((line) => line.description.trim())
    if (!validLines.length) return setMessage("Add at least one quote line.")
    setWorking(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/commercial/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            business_id: null,
            partner_id: selectedRequest.partner_id,
            partner_lead_id: selectedRequest.partner_lead_id,
            plan_id: form.planId,
            currency: form.currency,
            valid_until: form.validUntil || null,
            notes_public: form.publicNotes,
            notes_internal: form.internalNotes,
            payment_terms: form.paymentTerms,
            bank_details: bankDetails,
            template_industry: form.templateIndustry || null,
            items: validLines.map((line) => ({ ...line, line_total: Math.max(0, (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) - (Number(line.discount) || 0) + (line.tax_rate == null ? Number(line.tax) || 0 : ((Number(line.quantity) || 0) * (Number(line.unit_price) || 0) - (Number(line.discount) || 0)) * (Number(line.tax_rate) || 0) / 100)) })),
          },
        }),
      })
      const data = await res.json()
      if (!data.success) return setMessage(data.error || "Quote could not be created.")
      const quoteNumber = data.data?.quote_number
      if (issueNow && quoteNumber) {
        const issued = await fetch("/api/admin/partner-quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteRequestId: selectedRequest.id, decision: "ISSUED", issuedQuoteRef: quoteNumber, decisionReason: decisionNotes[selectedRequest.id] || "Created and issued from Partner Quotes." }) })
        const issuedData = await issued.json()
        if (!issuedData.success) return setMessage(`Quote ${quoteNumber} was created, but it was not issued: ${issuedData.error || "review the request"}`)
        setMessage(`Quote ${quoteNumber} created and issued.`)
      } else {
        setMessage(`Quote ${quoteNumber || ""} created as a draft. Use Issue from the request list when ready.`)
      }
      await loadWorkspace()
      switchTab("requests")
    } catch {
      setMessage("Quote could not be created.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FileText className="h-5 w-5" /> Partner Quotes</h2>
          <p className="text-muted-foreground">Review partner requests, create the Finance quote, and issue it from one workspace.</p>
        </div>
        <Button onClick={() => { setSelectedRequestId(openRequests[0]?.id || ""); switchTab("create") }}><Plus className="mr-1 h-4 w-4" /> Create quote</Button>
      </div>

      {message && <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}

      <div className="flex gap-2 border-b border-border">
        <button className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "requests" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`} onClick={() => switchTab("requests")}>Quote Requests <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{requests.length}</span></button>
        <button className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "create" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`} onClick={() => switchTab("create")}>Create Quote</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : tab === "requests" ? (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Partner request queue</CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No partner quote requests yet.</p> : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const open = ["SUBMITTED", "UNDER_REVIEW"].includes(request.status)
                  return <div key={request.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{request.partner_leads?.business_name || "Opportunity"}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(request.status)}`}>{enumLabel(request.status)}</span></div>
                        <p className="text-sm text-muted-foreground">{request.partners?.business_name || request.partners?.partner_id || "Partner"} · {request.plan_name || "Plan pending"} · {new Date(request.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">{[request.locations, request.users_estimate ? `${request.users_estimate} users` : null, request.services_requested].filter(Boolean).join(" · ") || "No extra requirements"}</p>
                        {request.issued_quote_ref && <p className="text-xs font-mono text-emerald-700">Quote: {request.issued_quote_ref}</p>}
                        {request.notes && <p className="mt-2 whitespace-pre-line text-sm">{request.notes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                        {open && <Button size="sm" variant="outline" onClick={() => decide(request.id, "UNDER_REVIEW")} disabled={working}><Clock3 className="mr-1 h-3.5 w-3.5" /> Reviewing</Button>}
                        {open && <Button size="sm" onClick={() => { chooseRequest(request.id); switchTab("create") }}><ArrowRight className="mr-1 h-3.5 w-3.5" /> Create quote</Button>}
                        {open && request.issued_quote_ref && <Button size="sm" variant="outline" onClick={() => decide(request.id, "ISSUED", request.issued_quote_ref || "")} disabled={working}><Send className="mr-1 h-3.5 w-3.5" /> Issue</Button>}
                        {open && <Button size="sm" variant="outline" onClick={() => decide(request.id, "DECLINED")} disabled={working}><X className="mr-1 h-3.5 w-3.5" /> Decline</Button>}
                      </div>
                    </div>
                    {open && <input value={decisionNotes[request.id] || ""} onChange={(e) => setDecisionNotes({ ...decisionNotes, [request.id]: e.target.value })} placeholder="Decision note (optional)" className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-xs" />}
                  </div>
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void createQuote(false) }} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">1. Link the request</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <select value={selectedRequestId} onChange={(e) => chooseRequest(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select an open partner quote request</option>
                {openRequests.map((request) => <option key={request.id} value={request.id}>{requestLabel(request)}</option>)}
              </select>
              {selectedRequest && <div className="rounded-md bg-muted/40 p-3 text-sm"><strong>{selectedRequest.partner_leads?.business_name || "Opportunity"}</strong><span className="text-muted-foreground"> · {selectedRequest.partner_leads?.contact_name || "Contact not supplied"} · {selectedRequest.partner_leads?.email || "No email"}</span><br /><span className="text-xs text-muted-foreground">The quote will remain lead-backed until the customer accepts it. No customer business is created here.</span></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">2. Commercial terms</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Plan *</span><select value={form.planId} onChange={(e) => { const plan = plans.find((p) => p.id === e.target.value); setForm({ ...form, planId: e.target.value }); if (plan) setLines((prev) => [{ ...emptyLine(), item_type: "PLAN", reference_id: plan.id, description: plan.name, unit_price: Number(plan.base_price) || 0 }, ...prev.filter((line) => line.description.trim())]) }} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Select active plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.base_price, plan.currency || "NGN")}</option>)}</select></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Template</span><select value={form.templateIndustry} onChange={(e) => applyTemplate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">{quoteTemplateOptions().map((option) => <option key={`${option.group}:${option.value}`} value={option.value}>{option.group} — {option.label}</option>)}</select></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Currency</span><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2"><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Valid until</span><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Payment terms</span><textarea rows={3} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Public notes</span><textarea rows={4} value={form.publicNotes} onChange={(e) => setForm({ ...form, publicNotes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <label className="space-y-1.5 text-sm md:col-span-2"><span className="font-medium">Internal notes</span><textarea rows={2} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 md:col-span-2"><strong>Payment account shown on quote:</strong><br />{bankDetails || "No bank account configured in Site Settings."}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-sm font-medium">3. Quote lines</CardTitle><Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="mr-1 h-3.5 w-3.5" /> Add line</Button></div></CardHeader>
            <CardContent className="space-y-3">
              {lines.map((line, index) => <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 md:grid-cols-12 md:items-start">
                <div className="space-y-1 md:col-span-5"><label className="text-xs font-medium">Catalogue item</label><select value={line.reference_id || ""} onChange={(e) => pickCatalog(index, e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"><option value="">Custom line / choose item</option>{catalog.map((item) => <option key={`${item.item_type}-${item.id}`} value={item.id}>{item.name} · {item.item_type} · {formatMoney(item.price, item.currency)}</option>)}</select><textarea rows={2} value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} placeholder="Line description" className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" /></div>
                <label className="space-y-1 text-xs md:col-span-2"><span className="font-medium">Qty</span><input type="number" min="0.01" step="any" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input px-2 py-2 text-sm" /></label>
                <label className="space-y-1 text-xs md:col-span-2"><span className="font-medium">Unit price</span><input type="number" min="0" step="any" value={line.unit_price} onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input px-2 py-2 text-sm" /></label>
                <label className="space-y-1 text-xs md:col-span-2"><span className="font-medium">Discount</span><input type="number" min="0" step="any" value={line.discount} onChange={(e) => updateLine(index, { discount: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input px-2 py-2 text-sm" /><span className="font-medium">Tax</span><select value={line.tax_rate == null ? "fixed" : String(line.tax_rate)} onChange={(e) => updateLine(index, e.target.value === "fixed" ? { tax_rate: null } : { tax_rate: Number(e.target.value), tax: 0 })} className="w-full rounded-md border border-input px-2 py-2 text-sm"><option value="0">No tax</option>{taxRates.map((tax) => <option key={`${tax.name}-${tax.rate}`} value={tax.rate}>{tax.name} ({tax.rate}%)</option>)}<option value="fixed">Fixed amount</option></select>{line.tax_rate == null && <input type="number" min="0" step="any" value={line.tax} onChange={(e) => updateLine(index, { tax: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input px-2 py-2 text-sm" />}</label>
                <div className="flex justify-end md:col-span-1"><Button type="button" variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>)}
              <div className="ml-auto max-w-xs space-y-1 border-t border-border pt-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(totals.subtotal, form.currency)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{formatMoney(totals.discount, form.currency)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoney(totals.tax, form.currency)}</span></div><div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{formatMoney(totals.total, form.currency)}</span></div></div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => switchTab("requests")}>Cancel</Button><Button type="submit" variant="outline" disabled={working || !selectedRequestId}><FileText className="mr-1 h-4 w-4" /> Save draft</Button><Button type="button" onClick={() => void createQuote(true)} disabled={working || !selectedRequestId}><CheckCircle2 className="mr-1 h-4 w-4" /> Create & issue quote</Button></div>
        </form>
      )}
    </div>
  )
}
