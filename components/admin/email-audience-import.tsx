"use client"
import { useMemo, useState } from "react"
import { CheckCircle2, Download, FileUp, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { inputClass } from "./email-campaign-shell"
import { downloadCsv } from "@/lib/email-campaign-report"
import { mapAudiencePhoneRows, mapAudienceRows, parseAudienceCsv } from "@/lib/audience-csv"

export default function EmailAudienceImport({ audiences, onImported }: { audiences: { id: string; name: string }[]; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<string[][]>([])
  const [raw, setRaw] = useState("")
  const [filename, setFilename] = useState("")
  const [audienceId, setAudienceId] = useState("")
  const [emailColumn, setEmailColumn] = useState(0)
  const [nameColumn, setNameColumn] = useState(-1)
  const [lastNameColumn, setLastNameColumn] = useState(-1)
  const [phoneColumn, setPhoneColumn] = useState(-1)
  const [header, setHeader] = useState(true)
  const [consent, setConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState("")
  const mapped = useMemo(() => emailColumn < 0 ? { contacts: [], invalid: [], duplicates: 0 } : mapAudienceRows(rows, emailColumn, nameColumn, lastNameColumn, header), [rows, emailColumn, nameColumn, lastNameColumn, header])
  const mappedPhones = useMemo(() => phoneColumn < 0 ? { contacts: [], invalid: [], duplicates: 0 } : mapAudiencePhoneRows(rows, phoneColumn, nameColumn, lastNameColumn, header), [rows, phoneColumn, nameColumn, lastNameColumn, header])
  function read(text: string, name: string) {
    setError(""); setResult("")
    try {
      const parsed = parseAudienceCsv(text)
      if (!parsed.length) throw new Error("No rows found in this file.")
      setRows(parsed); setFilename(name); setConsent(false); setSmsConsent(false)
      const normalized = parsed[0].map(value => value.toLowerCase().replace(/[\s_-]/g, ""))
      const email = normalized.findIndex(value => ["email", "emailaddress", "e-mail"].includes(value))
      const phone = normalized.findIndex(value => ["phone", "phonenumber", "mobile", "mobilenumber", "telephone"].includes(value))
      setHeader(email >= 0 || phone >= 0); setEmailColumn(email); setPhoneColumn(phone)
      const nameIndex = normalized.findIndex(value => ["name", "fullname", "firstname"].includes(value))
      setNameColumn(nameIndex)
      setLastNameColumn(normalized.findIndex(value => ["lastname", "surname"].includes(value)))
    } catch (e) { setRows([]); setError(e instanceof Error ? e.message : "Unable to read CSV") }
  }
  async function importContacts() {
    if (!audienceId || !mapped.contacts.length && !mappedPhones.contacts.length || mapped.contacts.length > 0 && !consent || mappedPhones.contacts.length > 0 && !smsConsent) return
    setBusy(true); setError(""); setResult("")
    try {
      const res = await fetch(`/api/admin/marketing/audiences/${encodeURIComponent(audienceId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ importContacts: mapped.contacts, emailConsentConfirmed: consent, importPhoneContacts: mappedPhones.contacts, smsConsentConfirmed: smsConsent }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed")
      setResult(`${data.contactsAdded} email contacts and ${data.smsContactsAdded || 0} SMS contacts imported. Existing contacts were skipped or updated without restoring opt-outs.`)
      setRows([]); setRaw(""); setConsent(false); setSmsConsent(false); onImported()
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed") }
    finally { setBusy(false) }
  }
  if (!open) return <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5 border-border"><div className="flex items-center gap-3"><FileUp className="h-6 w-6 text-retail" /><div><h2 className="font-semibold">Bring your audience with you</h2><p className="mt-1 text-xs text-muted-foreground">Import a CSV or paste a table. Map your columns and review before adding contacts.</p></div></div><Button size="sm" onClick={() => setOpen(true)}><Upload className="h-4 w-4" />Import contacts</Button></div>
  return <section className="space-y-5 rounded-xl border border-retail/20 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Import campaign contacts</h2><p className="mt-1 text-xs text-muted-foreground">Upload → Map email and phone columns → Confirm channel consent → Import</p></div><button aria-label="Close import" disabled={busy} onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{result && <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{result}</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-5"><label className="block text-sm font-medium">Import into audience<select className={inputClass} value={audienceId} onChange={e => setAudienceId(e.target.value)}><option value="">Choose an existing audience</option>{audiences.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{!audiences.length && <p className="text-xs text-muted-foreground">Create a named audience below, then import your contacts into it.</p>}
    {!rows.length ? <div className="grid gap-5 md:grid-cols-2"><div className="space-y-4 rounded-lg border border-dashed p-5 border-border"><label className="block text-sm font-medium">Upload CSV or TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="mt-3 block w-full text-xs" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 5_000_000) { setError("Choose a CSV smaller than 5 MB."); return } read(await file.text(), file.name) }} /></label><p className="text-xs text-muted-foreground">Up to 5,000 rows. CSVs may contain email, phone, or both. Export Excel files as CSV first.</p><button className="flex items-center gap-2 text-xs text-retail" onClick={() => downloadCsv("audience-import-template.csv", [["email", "phone", "first_name", "last_name"], ["ada@example.com", "+2348031234567", "Ada", "Okafor"]])}><Download className="h-3 w-3" />Download sample CSV</button></div><div><label className="block text-sm font-medium">Or paste a table<textarea className={`${inputClass} font-mono text-xs`} rows={4} value={raw} onChange={e => setRaw(e.target.value)} placeholder={"email,phone,name\nada@example.com,+2348031234567,Ada Okafor"} /></label><Button className="mt-2" size="sm" variant="outline" disabled={!raw.trim()} onClick={() => read(raw, "Pasted table")}>Map columns</Button></div></div> : <>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs"><span>{filename} · {rows.length - Number(header)} data rows</span><button onClick={() => { setRows([]); setConsent(false); setSmsConsent(false) }} className="text-retail">Choose another file</button></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={header} onChange={e => setHeader(e.target.checked)} />First row contains column headings</label>
      <div className="grid gap-4 md:grid-cols-4">{[{ label: "Email address", value: emailColumn, set: (value: number) => { setEmailColumn(value); setConsent(false) }, optional: true }, { label: "Phone number", value: phoneColumn, set: (value: number) => { setPhoneColumn(value); setSmsConsent(false) }, optional: true }, { label: "Name / first name", value: nameColumn, set: setNameColumn, optional: true }, { label: "Last name", value: lastNameColumn, set: setLastNameColumn, optional: true }].map(field => <label className="block text-xs font-medium" key={field.label}>{field.label}<select className={inputClass} value={field.value} onChange={e => field.set(Number(e.target.value))}><option value={-1}>Do not import</option>{rows[0].map((cell, i) => <option key={i} value={i}>{header ? cell || `Column ${i + 1}` : `Column ${i + 1}: ${cell}`}</option>)}</select></label>)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Emails ready", mapped.contacts.length], ["Phones ready", mappedPhones.contacts.length], ["Duplicate emails", mapped.duplicates], ["Duplicate phones", mappedPhones.duplicates]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>{mapped.invalid.length > 0 && <p className="text-xs text-amber-700">Invalid email on rows {mapped.invalid.slice(0, 20).join(", ")}{mapped.invalid.length > 20 ? "…" : ""}.</p>}{mappedPhones.invalid.length > 0 && <p className="text-xs text-amber-700">Invalid phone on rows {mappedPhones.invalid.slice(0, 20).join(", ")}{mappedPhones.invalid.length > 20 ? "…" : ""}.</p>}
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-xs"><caption className="bg-slate-50 px-3 py-2 text-left text-muted-foreground">Preview · first 5 contacts for each channel</caption><thead><tr><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Name</th></tr></thead><tbody>{Array.from({ length: Math.max(mapped.contacts.length, mappedPhones.contacts.length, 5) }).slice(0, 5).map((_, i) => <tr key={i} className="border-t border-border"><td className="p-3">{mapped.contacts[i]?.email || "—"}</td><td className="p-3">{mappedPhones.contacts[i]?.phone || "—"}</td><td className="p-3">{mapped.contacts[i]?.name || mappedPhones.contacts[i]?.name || "—"}</td></tr>)}</tbody></table></div>{mapped.contacts.length > 0 && <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />I confirm these contacts agreed to receive marketing emails. Existing unsubscribes stay suppressed.</label>}{mappedPhones.contacts.length > 0 && <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} />I confirm these contacts explicitly agreed to receive marketing SMS. Phone numbers are added to the SMS campaign recipient list.</label>}<Button size="sm" disabled={!audienceId || !mapped.contacts.length && !mappedPhones.contacts.length || mapped.contacts.length > 0 && !consent || mappedPhones.contacts.length > 0 && !smsConsent} onClick={importContacts}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Import {mapped.contacts.length + mappedPhones.contacts.length} contacts</Button>
    </>}</fieldset>
  </section>
}
