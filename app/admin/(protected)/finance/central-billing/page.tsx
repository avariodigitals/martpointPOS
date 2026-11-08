"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Bundle = { id: number; name: string; amount_kobo: number; credit_units: number; enabled: boolean }
type Credit = { channel: "sms" | "email"; product_code: string; price: string; minimum: string; tax_percent: string; enabled: boolean; bundles: Bundle[]; bundlesJson: string }
type Addon = { product_code: string; addon_key: string; name: string; fulfillment_type: "AUTOMATION_PLAN"; billing_period: "monthly" | "annual"; price: string; tax_percent: string; details: Record<string, unknown>; enabled: boolean }
type State = { products: Credit[]; addons: Addon[]; control: { price_owner: "CENTRAL" | "NEXT"; sync_status: string; source_version: string | null; synced_at: string | null } }

const naira = (kobo: number) => (Number(kobo) / 100).toFixed(2)
const percentFromBps = (bps: number) => (bps / 100).toFixed(2).replace(/\.00$/, "")
const bpsFromPercent = (percent: string) => Math.round(Number(percent) * 100)
const taxKobo = (netKobo: number, taxPercent: string) => Math.round(netKobo * bpsFromPercent(taxPercent) / 10000)
const money = (kobo: number) => `₦${naira(kobo)}`

export default function CentralBillingCataloguePage() {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/central-billing/catalogue", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Catalogue is unavailable")
      setState({
        control: data.control,
        products: (data.products || []).map((p: Record<string, unknown>) => { const bundles = (p.bundles || []) as Bundle[]; return { channel: p.channel as "sms" | "email", product_code: String(p.product_code), price: naira(Number(p.price_per_credit_kobo)), minimum: naira(Number(p.minimum_topup_kobo)), tax_percent: percentFromBps(Number(p.tax_bps)), enabled: !!p.active, bundles, bundlesJson: JSON.stringify(bundles, null, 2) } }),
        addons: (data.addons || []).map((p: Record<string, unknown>) => ({ product_code: String(p.product_code), addon_key: String(p.addon_key), name: String(p.name), fulfillment_type: "AUTOMATION_PLAN" as const, billing_period: p.billing_period as "monthly" | "annual", price: naira(Number(p.price_kobo)), tax_percent: percentFromBps(Number(p.tax_bps)), details: (p.details || {}) as Record<string, unknown>, enabled: !!p.active })),
      })
      setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "Catalogue load failed") }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  function updateCredit(index: number, key: keyof Credit, value: unknown) {
    setState((old) => old ? { ...old, products: old.products.map((p, i) => i === index ? { ...p, [key]: value } : p) } : old)
  }
  function updateAddon(index: number, key: keyof Addon, value: unknown) {
    setState((old) => old ? { ...old, addons: old.addons.map((p, i) => i === index ? { ...p, [key]: value } : p) } : old)
  }

  async function act(action: "take_ownership" | "save" | "publish") {
    if (!state) return
    setWorking(true); setError(""); setMessage("")
    try {
      const payload = action === "save" ? {
        action,
        products: state.products.map((p) => ({ channel: p.channel, product_code: p.product_code, price_per_credit_kobo: Math.round(Number(p.price) * 100), minimum_topup_kobo: Math.round(Number(p.minimum) * 100), tax_bps: bpsFromPercent(p.tax_percent), enabled: p.enabled, bundles: JSON.parse(p.bundlesJson) as Bundle[] })),
        addons: state.addons.map((p) => ({ product_code: p.product_code, addon_key: p.addon_key, name: p.name, fulfillment_type: p.fulfillment_type, billing_period: p.billing_period, price_kobo: Math.round(Number(p.price) * 100), tax_bps: bpsFromPercent(p.tax_percent), details: p.details, enabled: p.enabled })),
      } : { action }
      const response = await fetch("/api/admin/central-billing/catalogue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Catalogue operation failed")
      setMessage(action === "take_ownership" ? "Next Admin now owns the catalogue and published it to Central." : action === "publish" ? "The current Next catalogue was synchronized to Central." : "Prices saved in Next Admin and synchronized to Central.")
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Catalogue operation failed"); await load() }
    finally { setWorking(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!state) return <div className="space-y-4"><h1 className="text-2xl font-bold">Central Billing Catalogue</h1><p className="text-destructive">{error || "Catalogue could not be loaded."}</p><Button onClick={() => void load()}>Retry</Button></div>

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold">Central Billing Catalogue</h1><p className="text-sm text-muted-foreground">Manage the prices fleet stores see. Next Admin is the commercial source; Central receives a signed snapshot and keeps operational wallet rules.</p></div>
    <Card><CardHeader><CardTitle>Catalogue authority and synchronization</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm">Price owner: <strong>{state.control.price_owner}</strong> · Sync status: <strong>{state.control.sync_status}</strong>{state.control.synced_at ? ` · Last sync ${new Date(state.control.synced_at).toLocaleString()}` : ""}</p>
      {state.control.price_owner === "CENTRAL" ? <><p className="text-sm text-muted-foreground">Import the existing Central catalogue from Communications Admin first. Taking ownership freezes Central-side price imports; subsequent edits come from this page.</p><Button disabled={working || state.products.length !== 2} onClick={() => void act("take_ownership")}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Take ownership and publish</Button></> : <div className="flex flex-wrap gap-2"><Button disabled={working} onClick={() => void act("save")}><Save className="mr-2 h-4 w-4" />Save and publish prices</Button><Button variant="outline" disabled={working} onClick={() => void act("publish")}><RefreshCw className="mr-2 h-4 w-4" />Retry synchronization</Button></div>}
      {message && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}{error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}
    </CardContent></Card>
    {state.products.map((p, index) => <Card key={p.channel}><CardHeader><CardTitle className="capitalize">{p.channel} credits</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Price per credit (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0.01" max="100000" step="0.01" value={p.price} onChange={(e) => updateCredit(index, "price", e.target.value)} /></label>
      <label className="space-y-1 text-sm">Minimum custom top-up (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="5000" max="500000" step="0.01" value={p.minimum} onChange={(e) => updateCredit(index, "minimum", e.target.value)} /></label>
      <label className="space-y-1 text-sm">Tax rate (%)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0" max="100" step="0.01" value={p.tax_percent} onChange={(e) => updateCredit(index, "tax_percent", e.target.value)} /><span className="block text-xs text-muted-foreground">{p.tax_percent || "0"}% · tax per credit {money(taxKobo(Math.round(Number(p.price) * 100) || 0, p.tax_percent))} · total per credit {money((Math.round(Number(p.price) * 100) || 0) + taxKobo(Math.round(Number(p.price) * 100) || 0, p.tax_percent))}</span></label>
      <label className="flex items-center gap-2 text-sm"><input disabled={state.control.price_owner !== "NEXT"} type="checkbox" checked={p.enabled} onChange={(e) => updateCredit(index, "enabled", e.target.checked)} />Available for fleet purchase</label>
      <label className="space-y-1 text-sm sm:col-span-2">Bundles (JSON: id, name, amount_kobo, credit_units, enabled)<textarea disabled={state.control.price_owner !== "NEXT"} className="min-h-32 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" value={p.bundlesJson} onChange={(e) => updateCredit(index, "bundlesJson", e.target.value)} /></label>
    </CardContent></Card>)}
    <Card><CardHeader><CardTitle>Supported Automation plans</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Each plan period is invoiced in Next and activates through Central’s existing plan entitlement flow. Licence products are excluded. Other Central add-ons can be enabled only after their fulfilment behavior is implemented.</p>
      {state.addons.map((p, index) => { const netKobo = Math.round(Number(p.price) * 100) || 0; const vatKobo = taxKobo(netKobo, p.tax_percent); return <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4" key={p.product_code}><label className="space-y-1 text-sm">Plan name<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" value={p.name} onChange={(e) => updateAddon(index, "name", e.target.value)} /></label><label className="space-y-1 text-sm">Period<input disabled className="w-full rounded-md border bg-muted px-3 py-2" value={p.billing_period} /></label><label className="space-y-1 text-sm">Price before tax (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0" max="500000" step="0.01" value={p.price} onChange={(e) => updateAddon(index, "price", e.target.value)} /></label><label className="space-y-1 text-sm">Tax rate (%)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0" max="100" step="0.01" value={p.tax_percent} onChange={(e) => updateAddon(index, "tax_percent", e.target.value)} /><span className="block text-xs text-muted-foreground">Tax {money(vatKobo)} · total payable {money(netKobo + vatKobo)}</span></label><label className="flex items-center gap-2 text-sm"><input disabled={state.control.price_owner !== "NEXT"} type="checkbox" checked={p.enabled} onChange={(e) => updateAddon(index, "enabled", e.target.checked)} />Available for purchase</label><p className="self-center text-xs text-muted-foreground">{p.product_code}</p></div> })}
    </CardContent></Card>
  </div>
}
