"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, Code2, Eye, Loader2, Monitor, Send, Smartphone, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import EmailRichEditor from "./email-rich-editor"
import { CampaignBack, EmailCampaignShell, emailRoot, inputClass } from "./email-campaign-shell"
import { audienceLabels } from "@/lib/email-campaign-report"

interface Audience { id: string; name: string; contactCount: number }
interface Recipients { deliverable: number; total: number; suppressed: number; preview: { name: string; email: string }[] }
const starters = [
  { name: "Personal letter", html: '<p>Hi {{firstName}},</p><p>We have something new to share with you.</p><p>Write your message here.</p><p>Warm regards,<br>MartPoint team</p>' },
  { name: "Product announcement", html: '<p>WHAT’S NEW AT MARTPOINT</p><h2>A better way to run your business</h2><p>Hi {{firstName}},</p><p>Introduce your latest update and explain what it means for your customers.</p><hr><h3>Made for your everyday</h3><p>Add the details, benefits, and next steps here.</p><p><a href="https://martpoint.com.ng">Explore MartPoint →</a></p>' },
  { name: "Newsletter", html: '<p>THE MARTPOINT EDIT</p><h2>Your latest business updates</h2><p>Hi {{firstName}}, here’s what’s happening this month.</p><hr><h3>In the spotlight</h3><p>Share a story, helpful tip, or customer success.</p><h3>One thing to try this week</h3><p>Add a practical takeaway for your audience.</p><p><a href="https://martpoint.com.ng">Read more →</a></p>' },
]
export default function EmailCampaignComposer({ duplicateId }: { duplicateId?: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [html, setHtml] = useState("")
  const [source, setSource] = useState(false)
  const [provider, setProvider] = useState("default")
  const [audience, setAudience] = useState("newsletter")
  const [audienceId, setAudienceId] = useState("")
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [manualEmails, setManualEmails] = useState("")
  const [recipients, setRecipients] = useState<Recipients | null>(null)
  const [counting, setCounting] = useState(false)
  const [schedule, setSchedule] = useState("")
  const [later, setLater] = useState(false)
  const [consent, setConsent] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [preview, setPreview] = useState("")
  const [previewBusy, setPreviewBusy] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [sender, setSender] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [initializing, setInitializing] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    async function initialize() {
      try {
        const res = await fetch("/api/admin/marketing/audiences", { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Unable to load audiences")
        setAudiences(data.audiences || [])
        const senderRes = await fetch("/api/admin/marketing/sender", { signal: controller.signal })
        const senderData = await senderRes.json()
        if (!senderRes.ok) throw new Error(senderData.error || "Unable to load the configured sender")
        setSender(senderData.from || "")
        setReplyTo(senderData.replyTo || "")
        if (duplicateId) {
          const detail = await fetch(`/api/admin/marketing/${encodeURIComponent(duplicateId)}`, { signal: controller.signal })
          const data = await detail.json()
          if (!detail.ok) throw new Error(data.error || "Unable to duplicate campaign")
          const c = data.campaign
          setName(`${c.name} (copy)`); setSubject(c.subject); setPreheader(c.preheader); setHtml(c.html)
          setSource(/<html|<body/i.test(c.html)); setAudience(c.audience); setAudienceId(c.audienceId || ""); setProvider(c.provider || "default"); setSender(c.fromAddress || senderData.from || ""); setReplyTo(c.replyTo || senderData.replyTo || "")
          // Explicit recipient snapshots are not silently reused; the new audience is reviewed.
          if (c.audience === "manual") setManualEmails((data.recipients?.length ? data.recipients : data.sends || []).map((s: { email: string }) => s.email).join("\n"))
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load campaign") }
      finally { if (!controller.signal.aborted) setInitializing(false) }
    }
    void initialize()
    return () => controller.abort()
  }, [duplicateId])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setRecipients(null)
      if (audience === "saved" && !audienceId) return
      setCounting(true)
      try {
        const params = new URLSearchParams({ audience, audienceId, manual: manualEmails })
        const res = await fetch(`/api/admin/marketing/recipients?${params}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not count recipients")
        setRecipients(data)
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not count recipients") }
      finally { if (!controller.signal.aborted) setCounting(false) }
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [audience, audienceId, manualEmails])
  useEffect(() => {
    if (step < 2 || !html) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPreviewBusy(true)
      try {
        const res = await fetch("/api/admin/marketing/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, preheader, from: sender, replyTo }), signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Unable to render email preview")
        setPreview(data.html)
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to render email preview") }
      finally { if (!controller.signal.aborted) setPreviewBusy(false) }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [html, preheader, sender, replyTo, step])
  const valid = [Boolean(name.trim() && subject.trim() && sender.trim() && replyTo.trim()), Boolean(recipients?.deliverable && !counting), Boolean(html.replace(/<[^>]*>/g, "").trim() || /<img\b/i.test(html)), true]
  async function uploadImage(file: File) {
    try {
      const content = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file) })
      const res = await fetch("/api/admin/marketing/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type, content }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Image upload failed")
      return data.url as string
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed"); return null }
  }
  async function submit(test = false) {
    if (test ? !testEmail || !subject.trim() || !valid[2] : !valid.every(Boolean) || !consent) return
    setError(""); setNotice("")
    if (!test && later && (!schedule || new Date(schedule).getTime() <= Date.now())) { setError("Choose a future date and time."); return }
    if (test) setTestBusy(true); else setBusy(true)
    try {
      const res = await fetch("/api/admin/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, subject, preheader, html, provider, audience, audienceId, manualEmails, from: sender, replyTo, ...(test ? { testEmail } : { scheduledFor: later ? new Date(schedule).toISOString() : undefined }) }) })
      const data = await res.json()
      if (!res.ok || (test && !data.success)) throw new Error(data.error || "Email could not be sent")
      if (test) setNotice(`Test email sent to ${testEmail}. Check your inbox before launching.`)
      else if (data.campaignId) router.push(`${emailRoot}/${data.campaignId}`)
      else throw new Error(data.error || "Campaign could not be created")
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send email") }
    finally { setBusy(false); setTestBusy(false) }
  }
  const audienceName = audience === "saved" ? audiences.find(a => a.id === audienceId)?.name || "Choose an audience" : audienceLabels[audience]
  return <EmailCampaignShell>
    <CampaignBack />
    <header><h1 className="text-3xl font-bold tracking-tight">Create an email campaign</h1><p className="mt-2 text-sm text-muted-foreground">A considered message, from the right sender, to the right people.</p></header>
    <ol aria-label="Campaign setup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{["Setup", "Recipients", "Design", "Review & send"].map((title, i) => <li key={title}><button disabled={busy || initializing || (i > step && !valid.slice(0, i).every(Boolean))} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm ${i === step ? "border-retail bg-white shadow-sm" : "border-transparent bg-white/50 text-muted-foreground"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${i === step ? "bg-retail text-white" : "bg-slate-100"}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>{title}</button></li>)}</ol>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {initializing ? <div role="status" className="p-10 text-center">Loading campaign setup…</div> : <fieldset disabled={busy} className="min-w-0 space-y-5">
      {step === 0 && <section className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-6 sm:p-8 border-border"><div><h2 className="text-xl font-semibold">Start with the essentials</h2><p className="mt-1 text-sm text-muted-foreground">Give your campaign a name and make a good first impression in the inbox.</p></div><label className="block text-sm font-medium">Campaign name<input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. November product update" /><span className="mt-1 block text-xs font-normal text-muted-foreground">An internal name. Your subscribers won’t see this.</span></label><label className="block text-sm font-medium">Email subject<input className={inputClass} value={subject} onChange={e => setSubject(e.target.value)} placeholder="What’s new for your business?" /></label><label className="block text-sm font-medium">Preview text <span className="font-normal text-muted-foreground">(optional)</span><input className={inputClass} value={preheader} onChange={e => setPreheader(e.target.value)} placeholder="A little more context before they open" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Appears beside the subject in supported email clients.</span></label><label className="block text-sm font-medium">From name &amp; email<input className={inputClass} value={sender} onChange={e => setSender(e.target.value)} placeholder="MartPoint Team <hello@martpoint.com.ng>" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Use “Name &lt;email@example.com&gt;” or a mailbox address verified with your sending service.</span></label><label className="block text-sm font-medium">Reply-to address<input type="email" className={inputClass} value={replyTo.replace(/^.*<([^>]+)>.*$/, "$1")} onChange={e => setReplyTo(e.target.value)} placeholder="sales@martpoint.com.ng" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Where replies from your subscribers should go.</span></label><label className="block text-sm font-medium">Sending service<select className={inputClass} value={provider} onChange={e => setProvider(e.target.value)}><option value="default">Use Email Settings</option><option value="resend">Resend</option><option value="brevo">Brevo</option></select></label><p className="text-xs text-muted-foreground">Your default sender comes from <Link href="/admin/settings/email" className="text-retail underline">Email Settings</Link>. Personalize with {"{{firstName}}"}, {"{{name}}"}, and {"{{email}}"}.</p></section>}
      {step === 1 && <section className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-6 sm:p-8 border-border"><div><h2 className="text-xl font-semibold">Who are you writing to?</h2><p className="mt-1 text-sm text-muted-foreground">Choose a reusable list or one of your connected audiences.</p></div><label className="block text-sm font-medium">Audience source<select className={inputClass} value={audience} onChange={e => { setRecipients(null); setAudience(e.target.value) }}>{Object.entries(audienceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{audience === "saved" && <label className="block text-sm font-medium">Saved audience<select className={inputClass} value={audienceId} onChange={e => { setRecipients(null); setAudienceId(e.target.value) }}><option value="">Choose an audience</option>{audiences.map(a => <option key={a.id} value={a.id}>{a.name} · {a.contactCount} contacts</option>)}</select></label>}{audience === "manual" && <label className="block text-sm font-medium">Email addresses<textarea rows={6} className={`${inputClass} font-mono`} value={manualEmails} onChange={e => { setRecipients(null); setManualEmails(e.target.value) }} placeholder={"Ada <ada@example.com>\nola@example.com"} /></label>}<Link href={`${emailRoot}/audiences`} className="inline-flex items-center gap-2 text-sm text-retail"><Users className="h-4 w-4" />Create an audience or import a CSV</Link><div className="rounded-xl bg-slate-50 p-5"><p className="text-2xl font-semibold">{counting ? "Counting…" : (recipients?.deliverable ?? 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">eligible recipients</span></p><p className="mt-2 text-xs text-muted-foreground">{recipients?.suppressed || 0} unsubscribed contacts excluded. Suppression is checked again when sending.</p>{recipients?.preview.map(r => <p key={r.email} className="mt-2 text-xs text-muted-foreground">{r.name && `${r.name} · `}{r.email}</p>)}</div><p className="text-xs text-muted-foreground">Connected and saved audiences currently send to a maximum of 500 contacts per campaign.</p></section>}
      {step === 2 && <div className="grid items-start gap-5 xl:grid-cols-2"><section className="space-y-4 rounded-xl border bg-white p-5 border-border"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Design your email</h2><Button size="sm" variant="outline" onClick={() => { if (!source || !/<html|<body/i.test(html) || confirm("The visual editor simplifies full HTML documents. Continue?")) setSource(!source) }}><Code2 className="h-4 w-4" />{source ? "Visual editor" : "HTML source"}</Button></div>{!html && <div className="grid gap-2 sm:grid-cols-3">{starters.map(t => <button key={t.name} onClick={() => setHtml(t.html)} className="rounded-lg border p-4 text-left text-xs font-medium hover:border-retail">{t.name}<span className="mt-2 block font-normal text-muted-foreground">Use this starting point →</span></button>)}</div>}{source ? <label className="block text-sm">Email HTML<textarea rows={20} value={html} onChange={e => setHtml(e.target.value)} className={`${inputClass} font-mono text-xs`} placeholder="Paste your complete HTML email here…" /></label> : <EmailRichEditor value={html} onChange={setHtml} onUploadImage={uploadImage} minHeight={420} />}<label className="block rounded-lg border border-dashed p-3 text-xs text-muted-foreground border-border">Import an HTML email<input className="mt-2 block w-full text-xs" type="file" accept=".html,.htm,text/html" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 2_000_000) { setError("HTML must be smaller than 2 MB."); return } if (html && !confirm("Replace the current email with this file?")) return; setHtml(await file.text()); setSource(true) }} /></label></section>{renderPreview()}</div>}
      {step === 3 && <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.1fr]"><section className="space-y-6 rounded-xl border bg-white p-6 border-border"><h2 className="text-xl font-semibold">Ready for the inbox?</h2><dl className="space-y-4 text-sm">{[["Campaign", name], ["Subject", subject], ["Preview text", preheader || "None"], ["Audience", `${audienceName} · ${recipients?.deliverable || 0} recipients`], ["From", sender || "Configured in Email Settings"], ["Reply to", replyTo || "Not set"]].map(([key, value]) => <div key={key} className="border-b pb-3 border-border"><dt className="mb-1 text-xs text-muted-foreground">{key}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl><div><label className="block text-sm font-medium">Send a test email<input type="email" className={inputClass} value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com" /></label><Button className="mt-2" size="sm" variant="outline" onClick={() => submit(true)} disabled={testBusy || !testEmail}>{testBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send test</Button></div><div className="space-y-3 border-t pt-4 border-border"><label className="flex items-center gap-2 text-sm"><input type="radio" name="delivery" checked={!later} onChange={() => setLater(false)} />Send now</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="delivery" checked={later} onChange={() => setLater(true)} />Schedule for later</label>{later && <label className="block text-xs text-muted-foreground">Date & time ({Intl.DateTimeFormat().resolvedOptions().timeZone})<input type="datetime-local" className={inputClass} value={schedule} onChange={e => setSchedule(e.target.value)} /></label>}</div><label className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-xs leading-5"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />I have permission to email these contacts and have reviewed the recipients, subject, and content.</label><Button onClick={() => submit()} disabled={busy || !consent || counting || !valid.every(Boolean) || (later && !schedule)} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? "Preparing your campaign…" : later ? "Schedule campaign" : `Send to ${recipients?.deliverable || 0} recipients`}</Button></section>{renderPreview()}</div>}
      <div className="flex items-center justify-between border-t pt-5 border-border"><Button variant="outline" size="sm" onClick={() => setStep(step - 1)} disabled={step === 0 || busy}><ArrowLeft className="h-4 w-4" />Back</Button><span className="text-xs text-muted-foreground">Step {step + 1} of 4</span>{step < 3 ? <Button size="sm" onClick={() => setStep(step + 1)} disabled={!valid[step]}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Link href={emailRoot} className="text-sm text-muted-foreground">Close</Link>}</div>
    </fieldset>}
  </EmailCampaignShell>
  function renderPreview() {
    return <section className="overflow-hidden rounded-xl border bg-white border-border"><div className="flex items-center justify-between border-b p-4 border-border"><h2 className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" />Inbox preview {previewBusy && <Loader2 className="h-3 w-3 animate-spin" />}</h2><div className="flex gap-1"><button aria-label="Desktop preview" aria-pressed={!mobile} onClick={() => setMobile(false)} className={`rounded p-2 ${!mobile ? "bg-slate-100" : ""}`}><Monitor className="h-4 w-4" /></button><button aria-label="Mobile preview" aria-pressed={mobile} onClick={() => setMobile(true)} className={`rounded p-2 ${mobile ? "bg-slate-100" : ""}`}><Smartphone className="h-4 w-4" /></button></div></div><div className="space-y-1 border-b p-4 text-xs border-border"><p className="font-semibold">{subject || "Your email subject"}</p><p className="text-muted-foreground">{preheader || "Your preview text will appear here"}</p></div><div className="overflow-auto bg-slate-100 p-3"><iframe title="Email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview} className={`mx-auto h-[620px] max-w-full border-0 bg-white ${mobile ? "w-[375px]" : "w-full"}`} /></div><p className="p-3 text-[11px] text-muted-foreground">Sample personalization. Email clients may render content differently.</p></section>
  }
}
