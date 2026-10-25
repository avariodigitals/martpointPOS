"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Phone, PhoneOff, Mic, MicOff, X, Volume2 } from "lucide-react"
import { type CallSnapshot, type CallState } from "@/lib/azera-webrtc"
import { WebsiteCall } from "@/lib/azera-cloudflare-call"

interface UseWebRTCCallProps {
  callId: string; enabled?: boolean; isAgent: boolean; authToken?: string | null;
  localStream?: MediaStream; remoteAudioEl?: HTMLAudioElement;
  onCallEnded?: () => void; onCallError?: (msg: string) => void;
  onStartRecording?: () => void; onStopRecording?: () => void;
}

export function useWebRTCCall({ callId, enabled = true, isAgent, authToken, localStream,
  remoteAudioEl, onCallEnded, onCallError, onStartRecording, onStopRecording }: UseWebRTCCallProps) {
  const engine = useRef<WebsiteCall | null>(null)
  const [snapshot, setSnapshot] = useState<CallSnapshot>({ state: "idle", error: null, isMuted: false, audioBlocked: false })
  useEffect(() => {
    if (!enabled || !callId) return
    const current = new WebsiteCall({ callId, isAgent, authToken, localStream, remoteAudioEl, onChange: setSnapshot })
    engine.current = current
    // Strict Mode's setup/cleanup probe must not stop a real microphone or
    // place two offers. Only the effect that survives the probe starts work.
    queueMicrotask(() => { if (!current.disposed) void current.start() })
    const close = () => current.dispose()
    window.addEventListener("pagehide", close)
    return () => {
      window.removeEventListener("pagehide", close)
      current.dispose()
      if (engine.current === current) engine.current = null
    }
  }, [authToken, callId, enabled, isAgent, localStream, remoteAudioEl])
  useEffect(() => { if (snapshot.error) onCallError?.(snapshot.error) }, [snapshot.error, onCallError])
  useEffect(() => {
    if (!isAgent || snapshot.state !== "active") return
    let current = true
    const keepAlive = async () => {
      try {
        const response = await fetch("/api/admin/session", { method: "POST", signal: AbortSignal.timeout(10_000) })
        if (current && [401, 403].includes(response.status)) await engine.current?.end()
      } catch { /* Signaling has its own connection-loss handling. */ }
    }
    void keepAlive()
    const timer = window.setInterval(() => void keepAlive(), 30_000)
    return () => { current = false; window.clearInterval(timer) }
  }, [isAgent, snapshot.state])
  const endCall = useCallback(async (decline = false) => {
    const ended = await engine.current?.end(decline)
    if (ended !== false) onCallEnded?.()
  }, [onCallEnded])
  return { ...snapshot, startCall: () => engine.current?.start(), answerCall: () => engine.current?.answer(),
    endCall, toggleMute: () => engine.current?.toggleMute(), resumeAudio: () => engine.current?.resumeAudio(),
    onStartRecording, onStopRecording }
}

export function AzeraCallUI({ state, outgoing = false, customerName = "Customer", error,
  onAccept, onReject, onEnd, onToggleMute, isMuted = false, audioBlocked = false, onResumeAudio,
}: {
  state: CallState; isAgent?: boolean; outgoing?: boolean; customerName?: string; error?: string | null;
  onAccept?: () => void; onReject?: () => void; onEnd?: () => void; onToggleMute?: () => void;
  isMuted?: boolean; audioBlocked?: boolean; onResumeAudio?: () => void;
  onStartRecording?: () => void; onStopRecording?: () => void; isRecording?: boolean;
}) {
  if (state === "idle") return null
  const terminal = state === "ended" || state === "error"
  return (
    <section role="region" aria-label="Support call" className="fixed inset-x-4 top-24 z-[100] mx-auto w-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Phone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm font-semibold">{state === "error" ? "Couldn’t connect the call" : state === "ended" ? "Call ended" : state === "active" ? "Call connected" : state === "ringing" ? outgoing ? "Calling our team" : "Incoming support call" : "Connecting your call"}</p>
          <p className="truncate text-xs text-slate-500">{outgoing ? "MartPoint Support" : customerName}</p>
        </div>
        {terminal && <button onClick={onEnd} aria-label="Close call" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button>}
      </div>
      {state === "error" && <p role="alert" className="mt-3 break-words text-sm leading-6 text-red-700">{error || "The call could not connect. Please try again or message us here."}</p>}
      {audioBlocked && !terminal && <button onClick={onResumeAudio} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700"><Volume2 className="h-4 w-4" />Tap to hear the call</button>}
      {!terminal && <div className="mt-4 flex flex-wrap gap-2">
        {state === "ringing" && !outgoing && <button onClick={onAccept} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Answer</button>}
        {state === "active" && <button onClick={onToggleMute} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium">{isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{isMuted ? "Unmute" : "Mute"}</button>}
        <button onClick={state === "active" ? onEnd : onReject} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"><PhoneOff className="h-4 w-4" />{state === "active" ? "Hang up" : state === "ringing" && !outgoing ? "Decline" : "Cancel call"}</button>
      </div>}
    </section>
  )
}
