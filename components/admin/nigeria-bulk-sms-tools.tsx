"use client"

import { useState } from "react"

type Operation = "data" | "call" | "tts" | "audio" | "upload"
const actions = ["balance", "profile", "history", "reports", "scheduled", "contacts", "numbers", "groups", "audios", "payments"] as const
const modes: { value: Operation; label: string }[] = [
  { value: "data", label: "Account data" }, { value: "call", label: "Voice call" },
  { value: "tts", label: "Text to speech" }, { value: "audio", label: "Play audio" },
  { value: "upload", label: "Upload audio" },
]

export default function NigeriaBulkSmsTools() {
  const [operation, setOperation] = useState<Operation>("data")
  const [action, setAction] = useState<(typeof actions)[number]>("balance")
  const [to, setTo] = useState("")
  const [callerId, setCallerId] = useState("")
  const [message, setMessage] = useState("")
  const [audioReference, setAudioReference] = useState("")
  const [audioUrl, setAudioUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  async function run() {
    setBusy(true); setResult(null)
    try {
      const response = await fetch("/api/admin/communications/nigeria-gateway", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, action, to, callerId, message, audioReference, audioUrl }),
      })
      const data = await response.json().catch(() => ({ ok: false, error: "The gateway returned an unreadable response" }))
      setResult(data)
    } catch {
      setResult({ ok: false, error: "Gateway request failed" })
    } finally { setBusy(false) }
  }

  return <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <div><h3 className="font-semibold text-slate-900">Nigeria Bulk SMS account & voice tools</h3><p className="mt-1 text-xs leading-5 text-slate-600">This panel checks account data and runs voice/audio actions; it does not send SMS. Send text messages from the SMS campaign composer on this page. Voice actions can incur charges.</p></div>
    <div className="flex flex-wrap gap-2">{modes.map((mode) => <button key={mode.value} type="button" onClick={() => { setOperation(mode.value); setResult(null) }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${operation === mode.value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{mode.label}</button>)}</div>
    {operation === "data" && <div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Account data</label><div className="flex flex-wrap gap-2">{actions.map((item) => <button key={item} type="button" onClick={() => setAction(item)} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${action === item ? "border-blue-300 bg-blue-100 text-blue-900" : "border-slate-200 bg-white text-slate-600"}`}>{item}</button>)}</div></div>}
    {(operation === "call" || operation === "tts" || operation === "audio") && <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-700">Recipient phone<input className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" placeholder="+234 803 000 0000" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label className="text-xs font-semibold text-slate-700">Caller ID phone<input className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" placeholder="Approved phone number" value={callerId} onChange={(event) => setCallerId(event.target.value)} /></label>
      {operation === "audio" ? <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Uploaded audio reference<input className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" value={audioReference} onChange={(event) => setAudioReference(event.target.value)} /></label> : <label className="text-xs font-semibold text-slate-700 sm:col-span-2">{operation === "call" ? "Recorded call code" : "Words to speak"}<textarea rows={3} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" value={message} onChange={(event) => setMessage(event.target.value)} /></label>}
    </div>}
    {operation === "upload" && <label className="block text-xs font-semibold text-slate-700">Public HTTPS audio URL<input type="url" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" placeholder="https://example.com/recording.mp3" value={audioUrl} onChange={(event) => setAudioUrl(event.target.value)} /></label>}
    <button type="button" disabled={busy} onClick={() => void run()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Contacting provider…" : operation === "data" ? `Fetch ${action}` : operation === "upload" ? "Upload audio" : "Send voice action"}</button>
    {result !== null && <pre role="status" className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">{JSON.stringify(result, null, 2)}</pre>}
  </section>
}
