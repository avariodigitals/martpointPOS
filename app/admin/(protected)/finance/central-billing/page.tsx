"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Bundle = { id: number; name: string; amount_kobo: number; amount_input: string; credit_units: number; enabled: boolean }
type Credit = { channel: "sms" | "email"; product_code: string; price: string; minimum: string; tax_percent: string; enabled: boolean; bundles: Bundle[] }
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
        products: (data.products || []).map((p: Record<string, unknown>) => ({ channel: p.channel as "sms" | "email", product_code: String(p.product_code), price: naira(Number(p.price_per_credit_kobo)), minimum: naira(Number(p.minimum_topup_kobo)), tax_percent: percentFromBps(Number(p.tax_bps)), enabled: !!p.active, bundles: ((p.bundles || []) as Array<Omit<Bundle, "amount_input">>).map((bundle) => ({ ...bundle, amount_input: naira(Number(bundle.amount_kobo)) })) })),
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
  function updateBundle(productIndex: number, bundleIndex: number, key: keyof Bundle, value: unknown) {
    setState((old) => old ? {
      ...old,
      products: old.products.map((product, i) => i === productIndex
        ? { ...product, bundles: product.bundles.map((bundle, j) => j === bundleIndex ? { ...bundle, [key]: value } : bundle) }
        : product),
    } : old)
  }
  function updateBundlePrice(productIndex: number, bundleIndex: number, value: string) {
    setState((old) => old ? {
      ...old,
      products: old.products.map((product, i) => i === productIndex
        ? { ...product, bundles: product.bundles.map((bundle, j) => {
          if (j !== bundleIndex) return bundle
          const parsed = value.trim() === "" ? NaN : Number(value)
          return { ...bundle, amount_input: value, amount_kobo: Number.isFinite(parsed) ? Math.round(parsed * 100) : 0 }
        }) }
        : product),
    } : old)
  }
  function addBundle(productIndex: number) {
    setState((old) => {
      if (!old) return old
      const nextId = Math.max(0, ...old.products.flatMap((product) => product.bundles.map((bundle) => bundle.id))) + 1
      return {
        ...old,
        products: old.products.map((product, i) => i === productIndex
          ? { ...product, bundles: [...product.bundles, { id: nextId, name: "", amount_kobo: 10000, amount_input: "100.00", credit_units: 1, enabled: false }] }
          : product),
      }
    })
  }
  function removeBundle(productIndex: number, bundleIndex: number) {
    setState((old) => old ? {
      ...old,
      products: old.products.map((product, i) => i === productIndex
        ? { ...product, bundles: product.bundles.filter((_, j) => j !== bundleIndex) }
        : product),
    } : old)
  }

  function addPlan() {
    setState((old) => {
      if (!old) return old
      const key = `plan_${Date.now().toString(36)}`
      const details = { max_workflows: 10, template_keys: ["welcome", "winback", "newsletter", "custom"] }
      return { ...old, addons: [...old.addons,
        ...(["monthly", "annual"] as const).map((period) => ({ product_code: `automation-${key}-${period}`, addon_key: key, name: "New Automation Plan", fulfillment_type: "AUTOMATION_PLAN" as const, billing_period: period, price: "0.00", tax_percent: old.products[0]?.tax_percent || "7.5", details, enabled: false }))] }
    })
  }

  function removePlan(planKey: string) {
    setState((old) => old ? { ...old, addons: old.addons.filter((p) => p.addon_key !== planKey) } : old)
  }

  function addPlanFrequency(planKey: string, period: "monthly" | "annual") {
    setState((old) => {
      if (!old || old.addons.some((p) => p.addon_key === planKey && p.billing_period === period)) return old
      const existing = old.addons.find((p) => p.addon_key === planKey)
      if (!existing) return old
      return { ...old, addons: [...old.addons, { ...existing, billing_period: period, product_code: `automation-${planKey}-${period}`, price: "0.00", enabled: false }] }
    })
  }

  function removePlanFrequency(planKey: string, period: "monthly" | "annual") {
    setState((old) => old ? { ...old, addons: old.addons.filter((p) => p.addon_key !== planKey || p.billing_period !== period) } : old)
  }

  async function act(action: "take_ownership" | "save" | "publish") {
    if (!state) return
    setWorking(true); setError(""); setMessage("")
    try {
      const payload = action === "save" ? {
        action,
        products: state.products.map((p) => ({ channel: p.channel, product_code: p.product_code, price_per_credit_kobo: Math.round(Number(p.price) * 100), minimum_topup_kobo: Math.round(Number(p.minimum) * 100), tax_bps: bpsFromPercent(p.tax_percent), enabled: p.enabled, bundles: p.bundles.map(({ id, name, amount_kobo, credit_units, enabled }) => ({ id, name, amount_kobo, credit_units, enabled })) })),
        addons: state.addons.map((p) => ({ product_code: p.product_code, addon_key: p.addon_key, name: p.name, fulfillment_type: p.fulfillment_type, billing_period: p.billing_period, price_kobo: Math.round(Number(p.price) * 100), tax_bps: bpsFromPercent(p.tax_percent), details: p.details, enabled: p.enabled })),
      } : { action }
      const response = await fetch("/api/admin/central-billing/catalogue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Catalogue operation failed")
      setMessage(action === "take_ownership" ? "Next Admin now owns the catalogue and published it to Central." : action === "publish" ? "The current Next catalogue was synchronized to Central." : "Prices saved in Next Admin and synchronized to Central.")
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : "Catalogue operation failed") }
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
      <label className="space-y-1 text-sm">Minimum custom top-up (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0.01" max="500000" step="0.01" value={p.minimum} onChange={(e) => updateCredit(index, "minimum", e.target.value)} /><span className="block text-xs text-muted-foreground">Applies to custom top-ups. Published bundles use their own price and credit quantity.</span></label>
      <label className="space-y-1 text-sm">Tax rate (%)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0" max="100" step="0.01" value={p.tax_percent} onChange={(e) => updateCredit(index, "tax_percent", e.target.value)} /><span className="block text-xs text-muted-foreground">{p.tax_percent || "0"}% · tax per credit {money(taxKobo(Math.round(Number(p.price) * 100) || 0, p.tax_percent))} · total per credit {money((Math.round(Number(p.price) * 100) || 0) + taxKobo(Math.round(Number(p.price) * 100) || 0, p.tax_percent))}</span></label>
      <label className="flex items-center gap-2 text-sm"><input disabled={state.control.price_owner !== "NEXT"} type="checkbox" checked={p.enabled} onChange={(e) => updateCredit(index, "enabled", e.target.checked)} />Available for fleet purchase</label>
      <div className="space-y-3 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium">Credit bundles</h3><p className="text-xs text-muted-foreground">Set the bundle price before tax and the number of credits it includes.</p></div><Button type="button" variant="outline" size="sm" disabled={state.control.price_owner !== "NEXT"} onClick={() => addBundle(index)}><Plus className="mr-1 h-4 w-4" />Add bundle</Button></div>
        {p.bundles.length === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No bundles configured. Add one to offer a fixed-price credit package.</p> : p.bundles.map((bundle, bundleIndex) => { const bundleTax = taxKobo(bundle.amount_kobo, p.tax_percent); return <div key={bundle.id} className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(120px,.8fr)_minmax(120px,.8fr)_auto_auto]">
          <label className="space-y-1 text-sm">Bundle name<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" maxLength={100} value={bundle.name} onChange={(e) => updateBundle(index, bundleIndex, "name", e.target.value)} placeholder="e.g. SMS Starter" /></label>
          <label className="space-y-1 text-sm">Price before tax (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="100" max="500000" step="0.01" value={bundle.amount_input} onChange={(e) => updateBundlePrice(index, bundleIndex, e.target.value)} /><span className="block text-xs text-muted-foreground">Tax {money(bundleTax)} · total {money(bundle.amount_kobo + bundleTax)}</span></label>
          <label className="space-y-1 text-sm">Credits<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="1" max="10000000" step="1" value={bundle.credit_units} onChange={(e) => updateBundle(index, bundleIndex, "credit_units", Math.floor(Number(e.target.value)) || 0)} /></label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input disabled={state.control.price_owner !== "NEXT"} type="checkbox" checked={bundle.enabled} onChange={(e) => updateBundle(index, bundleIndex, "enabled", e.target.checked)} />Available</label>
          <Button type="button" variant="ghost" size="icon" disabled={state.control.price_owner !== "NEXT"} onClick={() => removeBundle(index, bundleIndex)} aria-label={`Remove ${bundle.name || "unnamed"} bundle`} title="Remove bundle"><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div> })}
      </div>
    </CardContent></Card>)}
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Automation plans</CardTitle><Button type="button" variant="outline" disabled={state.control.price_owner !== "NEXT" || working} onClick={addPlan}><Plus className="mr-1 h-4 w-4" />Add plan</Button></div></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Set each plan’s monthly and annual price here. Removing a plan or frequency archives its offer while preserving past invoices and active customer access. New plans include the standard automation templates and a 10 workflow allowance.</p>
      {Array.from(new Set(state.addons.map((p) => p.addon_key))).map((key) => {
        const plan = state.addons.filter((p) => p.addon_key === key).sort((a, b) => a.billing_period.localeCompare(b.billing_period))
        const first = plan[0]
        const planName = first?.name || key
        const setPlanName = (name: string) => setState((old) => old ? { ...old, addons: old.addons.map((p) => p.addon_key === key ? { ...p, name } : p) } : old)
        return <div className="space-y-3 rounded-lg border p-4" key={key}>
          <div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-48 flex-1 space-y-1 text-sm">Plan name<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" value={planName} onChange={(e) => setPlanName(e.target.value)} /></label><span className="pb-2 text-xs text-muted-foreground">{key}</span><Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={state.control.price_owner !== "NEXT"} onClick={() => removePlan(key)}><Trash2 className="mr-1 h-4 w-4" />Remove plan</Button></div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["monthly", "annual"] as const).map((period) => {
              const p = plan.find((item) => item.billing_period === period)
              if (!p) return <div key={period} className="flex items-center justify-between rounded-md border border-dashed p-3"><span className="text-sm capitalize">{period} frequency not offered</span><Button type="button" variant="outline" size="sm" disabled={state.control.price_owner !== "NEXT"} onClick={() => addPlanFrequency(key, period)}>Add {period}</Button></div>
              const index = state.addons.indexOf(p)
              const netKobo = Math.round(Number(p.price) * 100) || 0
              const vatKobo = taxKobo(netKobo, p.tax_percent)
              const unpriced = netKobo === 0
              return <div className="space-y-3 rounded-md bg-muted/30 p-3" key={p.product_code}>
                <div className="flex items-center justify-between"><h3 className="text-sm font-medium capitalize">{period}</h3><Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={state.control.price_owner !== "NEXT"} onClick={() => removePlanFrequency(key, period)} aria-label={`Remove ${period} frequency`}>Remove frequency</Button></div>
                <label className="block space-y-1 text-sm">Price before tax (NGN)<input disabled={state.control.price_owner !== "NEXT"} className="w-full rounded-md border bg-background px-3 py-2" type="number" min="0" max="500000" step="0.01" value={unpriced ? "" : p.price} placeholder="Set price" onChange={(e) => updateAddon(index, "price", e.target.value)} />{unpriced ? <span className="block text-xs text-amber-700">No price · unavailable for purchase</span> : <span className="block text-xs text-muted-foreground">Tax {money(vatKobo)} · total payable {money(netKobo + vatKobo)}</span>}</label>
                <label className="flex items-center gap-2 text-sm"><input disabled={state.control.price_owner !== "NEXT" || netKobo === 0} type="checkbox" checked={p.enabled} onChange={(e) => updateAddon(index, "enabled", e.target.checked)} />Available for purchase</label>
              </div>
            })}
          </div>
        </div>
      })}
      {state.addons.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No Automation plans. Add a plan to create monthly and annual offers.</p>}
    </CardContent></Card>
  </div>
}
