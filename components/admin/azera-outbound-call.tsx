"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react"
import { BrowserPhoneCall, type PhoneCallSnapshot } from "@/lib/azera-phone-call"

export interface OutboundContact { id: string; name: string; phone: string }
export function AzeraOutboundCall({ contact, onClosed }: { contact: OutboundContact; onClosed: () => void }) {
  const engine = useRef<BrowserPhoneCall | null>(null)
  const [call, setCall] = useState<PhoneCallSnapshot>({ state: "connecting", error: null, muted: false, audioBlocked: false, setupRequired: false })
  const [ending, setEnding] = useState(false)
  useEffect(() => {
    const current = new BrowserPhoneCall(contact.id, setCall)
    engine.current = current
    queueMicrotask(() => { if (!current.disposed) void current.start() })
    const close = () => current.dispose()
    window.addEventListener("pagehide", close)
    return () => { window.removeEventListener("pagehide", close); current.dispose() }
  }, [contact.id])
  async function end() {
    setEnding(true)
    if (await engine.current?.end()) onClosed()
    setEnding(false)
  }
  return <section aria-label="Outbound phone call" className="fixed bottom-5 right-5 z-[100] w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Phone className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">{contact.name}</h2><p className="text-xs text-slate-500">{contact.phone}</p></div></div>
    <p role="status" className="mt-3 text-sm font-medium text-slate-700">{call.state === "connecting" ? "Connecting your browser…" : call.state === "ringing" ? "Calling customer…" : call.state === "active" ? "Call connected" : call.state === "ended" ? "Call ended" : "Call unavailable"}</p>
    {call.error && <p role="alert" className="mt-2 text-sm leading-6 text-red-700">{call.error}</p>}
    {call.setupRequired && <Link className="mt-3 block text-sm font-semibold text-blue-600 underline" href="/admin/integrations">Open voice integrations</Link>}
    {call.audioBlocked && <button onClick={() => void engine.current?.resumeAudio()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-700"><Volume2 className="h-4 w-4" />Tap to hear the call</button>}
    <div className="mt-4 flex gap-2">{["active", "ringing"].includes(call.state) && <button onClick={() => void engine.current?.toggleMute()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium">{call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{call.muted ? "Unmute" : "Mute"}</button>}<button disabled={ending} onClick={() => void end()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"><PhoneOff className="h-4 w-4" />{ending ? "Ending…" : call.setupRequired || call.state === "ended" ? "Close" : "End call"}</button></div>
  </section>
}
