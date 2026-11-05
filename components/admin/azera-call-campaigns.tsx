"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Check, Loader2, Megaphone, Pause, Play, RefreshCw, Users, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseAudienceCsv } from "@/lib/audience-csv"
import { strFromU8, unzipSync } from "fflate"
import { normalizeDialNumber } from "@/lib/browser-phone-target"

type Purpose = "estimate_followup" | "quote_followup" | "lead_reengagement" | "uploaded_contacts"
type UploadedContact = { name: string; phone: string }
type Language = "en" | "ha" | "ig" | "yo"
type SpeechProvider = "africa_talking" | "naija_speech"
type Campaign = { id: string; name: string; purpose: Purpose; goal: string; status: string; target_count: number; max_calls: number; script_template?: string; speech_provider?: SpeechProvider; speech_language?: Language; speech_voice?: string; created_at?: string; assigned_user_id?: string | null; assigned_queue?: string | null }
type Assignee = { id: string; name: string }
type Preview = { total: number; preview: { contactName: string; businessName: string; phone: string; productInterest: string }[] }
type Recipient = { id: string; contact_name: string; business_name: string; phone: string; product_interest: string; status: string; response_label: string | null; notes: string | null; provider_error: string | null }

const PURPOSES: { id: Purpose; title: string; description: string }[] = [
  { id: "estimate_followup", title: "Follow up on an old estimate", description: "Unconverted website estimates older than the selected number of days." },
  { id: "quote_followup", title: "Follow up on an expired quote", description: "Sent quotes past their validity date, where the lead has not converted." },
  { id: "lead_reengagement", title: "Reconnect with older enquiries", description: "Older unconverted leads with a phone number." },
]
const SPEECH_VOICES: Record<Language, { name: string; id: string }[]> = {
  en: ["idera", "emma", "jude", "osagie", "tayo", "zainab", "joke", "regina", "remi", "umar", "chinenye", "onye"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })),
  ha: ["hausa_male2", "hausa_female1", "hausa_female2", "hausa_male1", "hausa_clear"].map((id) => ({ id, name: id.replace("hausa_", "").replaceAll("_", " ") })),
  ig: ["igbo_female2", "igbo_male2", "igbo_female1"].map((id) => ({ id, name: id.replace("igbo_", "").replaceAll("_", " ") })),
  yo: ["yoruba_male2", "yoruba_female2", "yoruba_female1", "yoruba_clear"].map((id) => ({ id, name: id.replace("yoruba_", "").replaceAll("_", " ") })),
}
const statusClass: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700", dialing: "bg-blue-100 text-blue-800", answered: "bg-emerald-100 text-emerald-800",
  callback_requested: "bg-amber-100 text-amber-800", not_interested: "bg-slate-100 text-slate-600", no_response: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-700", suppressed: "bg-slate-100 text-slate-500",
}
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
function parseVoiceContactRows(rows: string[][]) {
  if (!rows.length) throw new Error("No contacts were found in this file.")
  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "")
  const headers = rows[0].map(normalizeHeader)
  const phoneColumn = headers.findIndex(value => ["phone", "phonenumber", "mobile", "mobilenumber", "telephone"].includes(value))
  const nameColumn = headers.findIndex(value => ["name", "fullname", "contactname", "customername"].includes(value))
  if (phoneColumn < 0) throw new Error("Add a column heading called phone or mobile, then upload the file again.")
  const contacts: UploadedContact[] = []
  const seen = new Set<string>()
  let invalid = 0
  for (const row of rows.slice(1)) {
    const phone = normalizeDialNumber(row[phoneColumn] || "")
    if (!phone) { invalid++; continue }
    if (seen.has(phone)) continue
    seen.add(phone)
    contacts.push({ name: nameColumn >= 0 ? (row[nameColumn] || "").trim().slice(0, 120) : "", phone })
  }
  if (!contacts.length) throw new Error("No valid phone numbers were found. Use a phone or mobile column with international or Nigerian numbers.")
  if (contacts.length > 100) throw new Error("A voice campaign can contain up to 100 unique contacts. Split this file into smaller lists.")
  return { contacts, invalid }
}

function xmlDocument(source: string) {
  const document = new DOMParser().parseFromString(source, "application/xml")
  if (document.getElementsByTagName("parsererror").length) throw new Error("This Excel workbook could not be read.")
  return document
}

function parseVoiceContacts(raw: string) {
  return parseVoiceContactRows(parseAudienceCsv(raw))
}

async function parseVoiceContactFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return parseVoiceContacts(await file.text())
  if (typeof DOMParser === "undefined") throw new Error("Excel workbooks can only be read in a supported browser.")
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const workbookXml = files["xl/workbook.xml"]
  const relationshipsXml = files["xl/_rels/workbook.xml.rels"]
  if (!workbookXml || !relationshipsXml) throw new Error("This Excel workbook could not be read.")
  const workbook = xmlDocument(strFromU8(workbookXml))
  const firstSheet = workbook.getElementsByTagName("sheet")[0]
  const relationshipId = firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
  const relationships = xmlDocument(strFromU8(relationshipsXml))
  const sheetTarget = Array.from(relationships.getElementsByTagName("Relationship"))
    .find(item => item.getAttribute("Id") === relationshipId)?.getAttribute("Target")
  if (!sheetTarget) throw new Error("This Excel workbook has no readable contact sheet.")
  const sheetPath = sheetTarget.startsWith("/") ? sheetTarget.slice(1) : `xl/${sheetTarget.replace(/^\.\//, "")}`
  const sheetXml = files[sheetPath]
  if (!sheetXml) throw new Error("This Excel workbook has no readable contact sheet.")
  const sharedXml = files["xl/sharedStrings.xml"]
  const sharedStrings = sharedXml ? Array.from(xmlDocument(strFromU8(sharedXml)).getElementsByTagName("si"))
    .map(item => Array.from(item.getElementsByTagName("t")).map(text => text.textContent || "").join("")) : []
  const sheet = xmlDocument(strFromU8(sheetXml))
  const rows = Array.from(sheet.getElementsByTagName("row")).map(row => {
    const values: string[] = []
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const reference = cell.getAttribute("r") || ""
      const column = reference.match(/^[A-Z]+/i)?.[0]
      if (!column) continue
      let index = 0
      for (const character of column.toUpperCase()) index = index * 26 + character.charCodeAt(0) - 64
      index -= 1
      const type = cell.getAttribute("t")
      const rawValue = type === "inlineStr"
        ? Array.from(cell.getElementsByTagName("t")).map(text => text.textContent || "").join("")
        : cell.getElementsByTagName("v")[0]?.textContent || ""
      values[index] = type === "s" ? sharedStrings[Number(rawValue)] || "" : rawValue
    }
    return values.map(value => value || "")
  })
  return parseVoiceContactRows(rows)
}

export function AzeraCallCampaigns({ embedded = false }: { embedded?: boolean }) {
  const [audienceMode, setAudienceMode] = useState<"leads" | "upload">("leads")
  const [uploadedContacts, setUploadedContacts] = useState<UploadedContact[]>([])
  const [uploadName, setUploadName] = useState("")
  const [invalidUploadRows, setInvalidUploadRows] = useState(0)
  const [voiceConsentConfirmed, setVoiceConsentConfirmed] = useState(false)
  const [purpose, setPurpose] = useState<Purpose>("estimate_followup")
  const [days, setDays] = useState(14)
  const [maxCalls, setMaxCalls] = useState(25)
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>("africa_talking")
  const [speechLanguage, setSpeechLanguage] = useState<Language>("en")
  const [speechVoice, setSpeechVoice] = useState("idera")
  const [name, setName] = useState("Estimate follow-up")
  const [goal, setGoal] = useState("Check whether the business still wants help with its estimate and, if so, arrange a human follow-up.")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [assignment, setAssignment] = useState("")
  const [ready, setReady] = useState(false)
  const [naijaTtsReady, setNaijaTtsReady] = useState(false)
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async (campaignId?: string) => {
    try {
      const response = await fetch(`/api/admin/azera/campaigns${campaignId ? `?id=${encodeURIComponent(campaignId)}` : ""}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load campaign data.")
      if (campaignId) {
        setSelected(data.campaign)
        setRecipients(data.recipients || [])
      } else {
        setCampaigns(data.campaigns || [])
        setAssignees(data.assignees || [])
        setReady(Boolean(data.ready))
        setNaijaTtsReady(Boolean(data.naijaTtsReady))
      }
      setError("")
    } catch (caught) {
      setError(embedded ? "Campaigns could not load. Please try again." : caught instanceof Error ? caught.message : "Could not load campaign data.")
    } finally { setLoading(false) }
  }, [embedded])

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer) }, [load])
  useEffect(() => {
    if (audienceMode === "upload") return
    let alive = true
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ purpose, days: String(days) })
        const response = await fetch(`/api/admin/azera/campaigns?${params}`, { cache: "no-store", signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not preview the audience.")
        if (alive) setPreview(data)
      } catch (caught) {
        if (alive && !(caught instanceof Error && caught.name === "AbortError")) setPreview(null)
      }
    }, 250)
    return () => { alive = false; controller.abort(); clearTimeout(timer) }
  }, [audienceMode, purpose, days])

  useEffect(() => {
    if (!selected || selected.status !== "running") return
    const timer = setInterval(() => { void load(selected.id); void load() }, 30_000)
    return () => clearInterval(timer)
  }, [selected, load])

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("")
    try {
      const selectedPurpose = audienceMode === "upload" ? "uploaded_contacts" : purpose
      const response = await fetch("/api/admin/azera/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, purpose: selectedPurpose, goal, audienceDays: days, maxCalls, speechProvider, speechLanguage, speechVoice, contacts: audienceMode === "upload" ? uploadedContacts : undefined, voiceConsentConfirmed, assignedUserId: assignment.startsWith("user:") ? assignment.slice(5) : null, assignedQueue: assignment.startsWith("queue:") ? assignment.slice(6) : null }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not create campaign.")
      setNotice(`Campaign draft created with ${data.count} eligible contact${data.count === 1 ? "" : "s"}. Review it here before starting.`)
      setSelected(data.campaign)
      setRecipients([])
      await load()
    } catch (caught) { setError(embedded ? "The campaign could not be saved. Please check the details and try again." : caught instanceof Error ? caught.message : "Could not create campaign.") }
    finally { setBusy(false) }
  }

  async function changeStatus(campaign: Campaign, status: "running" | "paused" | "completed") {
    if (status === "running" && !window.confirm(`Start “${campaign.name}”? This will place up to ${campaign.target_count} real calls and may incur calling charges.`)) return
    if (status === "completed" && !window.confirm(`End “${campaign.name}”? Any remaining contacts will not be called.`)) return
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch(`/api/admin/azera/campaigns/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Campaign could not be updated.")
      setNotice(status === "running" ? "Campaign started. Calls will begin shortly." : status === "paused" ? "Campaign paused. Any call already in progress will finish." : "Campaign ended. Remaining contacts will not be called.")
      await load(campaign.id); await load()
    } catch (caught) { setError(embedded ? "The campaign could not be updated. Please try again." : caught instanceof Error ? caught.message : "Campaign could not be updated.") }
    finally { setBusy(false) }
  }

  return <div className={embedded ? "min-w-0 space-y-4 text-sm" : "mx-auto min-w-0 w-full max-w-6xl space-y-6 px-0 sm:px-2"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>{!embedded && <p className="text-sm font-semibold text-blue-700">Omnichannel · Voice</p>}<h1 className={`${embedded ? "text-lg" : "mt-1 text-2xl"} font-semibold text-slate-950`}>Voice campaigns</h1>{!embedded && <p className="mt-1 max-w-3xl text-sm text-slate-600">Build a targeted follow-up, review who will be called, then start or pause the campaign from here.</p>}</div>
      <Button variant="outline" size={embedded ? "sm" : "default"} onClick={() => { void load(); if (selected) void load(selected.id) }} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    </div>
    {!embedded && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950"><strong>What this voice campaign does:</strong> Azera prepares a personalized opening using the selected lead context and estimate/quote, identifies itself as an automated assistant, and records keypad responses. Press 1 requests a team follow-up, 2 requests a call back, and 3 opts the number out of future automated calls. This version does not understand free-form spoken replies. <span className="font-medium">Calls are sent through Africa’s Talking and can incur charges.</span></div>}
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="mr-2 inline h-4 w-4" />{notice}</div>}
    {!ready && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{embedded ? "Campaign calling is not available right now. You can still prepare a draft." : "Live Africa’s Talking credentials and a mapped virtual number are required before a campaign can start. Existing drafts remain available."}</div>}

    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
      <Card className="min-w-0 overflow-hidden"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-700" />Create campaign</CardTitle></CardHeader><CardContent className="min-w-0 p-4 pt-0 sm:p-6 sm:pt-0">
        <form onSubmit={createCampaign} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" aria-pressed={audienceMode === "leads"} onClick={() => { setAudienceMode("leads"); setPreview(null); }} className={`min-h-10 rounded-lg text-sm font-semibold ${audienceMode === "leads" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Lead follow-up</button><button type="button" aria-pressed={audienceMode === "upload"} onClick={() => { setAudienceMode("upload"); setPreview(null); }} className={`min-h-10 rounded-lg text-sm font-semibold ${audienceMode === "upload" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Upload contacts</button></div>
          <label className="block text-sm font-medium text-slate-800">Campaign name<input required minLength={3} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" /></label>
          <label className="block text-sm font-medium text-slate-800">Assign to<select required value={assignment} onChange={event => setAssignment(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3"><option value="">Choose a voice user or queue</option><optgroup label="Queues"><option value="queue:sales">Sales queue</option><option value="queue:support">Support queue</option><option value="queue:onboarding">Onboarding queue</option><option value="queue:customer_support">General enquiries queue</option></optgroup>{assignees.length > 0 && <optgroup label="Team members">{assignees.map(person => <option key={person.id} value={`user:${person.id}`}>{person.name}</option>)}</optgroup>}</select><span className="mt-1 block text-xs font-normal text-slate-500">The assigned person or queue will see it in their softphone.</span></label>
          {audienceMode === "leads" ? <label className="block text-sm font-medium text-slate-800">What is this campaign about?<select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{PURPOSES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">{PURPOSES.find((item) => item.id === purpose)?.description}</span></label> : <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"><label className="block text-sm font-medium text-slate-800">Upload contacts<input type="file" accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setError(""); setUploadedContacts([]); setVoiceConsentConfirmed(false); if (file.size > 5_000_000) { setError("Choose a contact file smaller than 5 MB."); return } try { const parsed = await parseVoiceContactFile(file); setUploadedContacts(parsed.contacts); setInvalidUploadRows(parsed.invalid); setUploadName(file.name); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read this contact file."); } }} className="mt-2 block w-full text-xs" /></label><p className="text-xs leading-5 text-slate-600">Use an Excel workbook, CSV or TSV with a <strong>phone</strong> or <strong>mobile</strong> column and an optional <strong>name</strong> column. Up to 100 unique contacts. Existing opt-outs and numbers called in the last 30 days are skipped.</p>{uploadedContacts.length > 0 && <><div className="rounded-lg bg-white p-3 text-xs text-slate-700">{uploadName} · {uploadedContacts.length} valid contacts{invalidUploadRows ? ` · ${invalidUploadRows} invalid rows skipped` : ""}</div><ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg bg-white p-3 text-xs text-slate-600">{uploadedContacts.slice(0, 5).map(contact => <li key={contact.phone} className="flex justify-between gap-2"><span className="truncate">{contact.name || "Contact"}</span><span>{contact.phone}</span></li>)}</ul><label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" checked={voiceConsentConfirmed} onChange={event => setVoiceConsentConfirmed(event.target.checked)} className="mt-1"/>I confirm these contacts agreed to receive calls from MartPoint.</label></>}</div>}
          {!embedded && <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">Call voice provider<select value={speechProvider} onChange={(event) => setSpeechProvider(event.target.value as SpeechProvider)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="africa_talking">Africa’s Talking voice</option><option value="naija_speech" disabled={!naijaTtsReady}>Naija Speech{naijaTtsReady ? "" : " — API key required"}</option></select></label>
            <label className="text-sm font-medium text-slate-800">Language<select value={speechLanguage} disabled={speechProvider !== "naija_speech"} onChange={(event) => { const next = event.target.value as Language; setSpeechLanguage(next); setSpeechVoice(SPEECH_VOICES[next][0].id) }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="en">Nigerian English</option><option value="ha">Hausa</option><option value="ig">Igbo</option><option value="yo">Yoruba</option></select></label>
            {speechProvider === "naija_speech" && <label className="text-sm font-medium text-slate-800 sm:col-span-2">Voice<select value={speechVoice} onChange={(event) => setSpeechVoice(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{SPEECH_VOICES[speechLanguage].map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>}
          </div>}
          {!embedded && speechProvider === "naija_speech" && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Naija Speech generates the selected language and voice. Africa’s Talking still places the call and plays the audio; its call charges are separate.</p>}
          <label className="block text-sm font-medium text-slate-800">What should the call cover?<textarea required minLength={8} maxLength={500} rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /><span className="mt-1 block text-xs font-normal text-slate-500">Keep it brief and do not include private account details.</span></label>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">{audienceMode === "leads" && <label className="text-sm font-medium text-slate-800">Enquiry age<input type="number" min={1} max={365} value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" /><span className="mt-1 block text-xs font-normal text-slate-500">Minimum days since enquiry</span></label>}<label className="text-sm font-medium text-slate-800">Call limit<input type="number" min={1} max={100} value={maxCalls} onChange={(event) => setMaxCalls(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3" /><span className="mt-1 block text-xs font-normal text-slate-500">Maximum 100 recipients per campaign</span></label></div>
          {audienceMode === "leads" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4" />Eligible contacts</p><p className="text-sm font-semibold text-slate-900">{preview?.total ?? "—"}</p></div><p className="mt-1 text-xs text-slate-600">Converted leads, won/lost leads, leads without a usable phone, and opted-out numbers are excluded. Only the first {maxCalls} eligible contacts are added.</p>{preview?.preview?.length ? <ul className="mt-2 divide-y divide-slate-200 text-xs text-slate-700">{preview.preview.slice(0, 5).map((item, index) => <li key={`${item.phone}-${index}`} className="flex justify-between gap-2 py-1.5"><span className="truncate">{item.contactName} · {item.businessName}</span><span className="shrink-0 text-slate-500">{item.phone}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No preview contacts for these criteria yet.</p>}</div> : <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><span>Contacts in this draft</span><strong>{Math.min(maxCalls, uploadedContacts.length)}</strong></div>}
          <Button type="submit" disabled={busy || (audienceMode === "leads" ? !preview?.total : !uploadedContacts.length || !voiceConsentConfirmed)} className="min-h-11 w-full"><Loader2 className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : "hidden"}`} />Save campaign draft</Button>
        </form>
      </CardContent></Card>

      <Card className="min-w-0 overflow-hidden"><CardHeader className="p-4 sm:p-6"><CardTitle>Campaigns and responses</CardTitle></CardHeader><CardContent className="min-w-0 space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
        {campaigns.length === 0 ? <p className="text-sm text-slate-600">No call campaigns yet.</p> : campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => void load(campaign.id)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === campaign.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}><span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{campaign.name}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{label(campaign.status)}</span></span><span className="mt-1 block text-xs text-slate-600">{campaign.target_count} contacts · {label(campaign.purpose)} · Assigned to {campaign.assigned_queue ? label(campaign.assigned_queue) + " queue" : assignees.find(person => person.id === campaign.assigned_user_id)?.name || "team member"}</span></button>)}
        {selected && <div className="border-t border-slate-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">{selected.name}</p><p className="text-xs text-slate-600">{selected.target_count} recipients · {label(selected.status)}</p></div><div className="flex gap-2">{selected.status === "running" ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus(selected, "paused")}><Pause className="mr-1 h-4 w-4" />Pause</Button> : selected.status === "draft" || selected.status === "paused" ? <Button size="sm" disabled={busy || !ready} onClick={() => void changeStatus(selected, "running")}><Play className="mr-1 h-4 w-4" />Start</Button> : null}{["draft", "running", "paused"].includes(selected.status) && <Button variant="outline" size="sm" disabled={busy} onClick={() => void changeStatus(selected, "completed")}><X className="mr-1 h-4 w-4" />End</Button>}</div></div>{selected.script_template && <details className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><summary className="cursor-pointer font-medium">Review the call opening</summary><p className="mt-2">{selected.script_template}</p></details>}<div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{recipients.length ? recipients.map((recipient) => <div key={recipient.id} className="rounded-lg border border-slate-200 p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-900">{recipient.contact_name} · {recipient.business_name}</span><span className={`rounded-full px-2 py-1 text-[11px] ${statusClass[recipient.status] || "bg-slate-100 text-slate-700"}`}>{label(recipient.status)}</span></div>{recipient.response_label && <p className="mt-1 text-xs text-slate-600">{recipient.response_label}</p>}{recipient.provider_error && <p className="mt-1 text-xs text-red-700">{recipient.provider_error}</p>}{recipient.notes && <p className="mt-1 text-xs text-slate-600">{recipient.notes}</p>}</div>) : <p className="text-sm text-slate-500">Contact outcomes appear here as calls complete.</p>}</div></div>}
      </CardContent></Card>
    </div>
    {!embedded && <p className="text-xs leading-5 text-slate-500">One recipient is queued per five-minute worker run, during the voice business schedule. Calls are not automatically retried. A person can opt out by pressing 3, and suppressed numbers are removed from later audiences.</p>}
  </div>
}
