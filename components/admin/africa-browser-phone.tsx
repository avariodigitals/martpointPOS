"use client";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneIncoming, PhoneOff, Mic, MicOff, Pause, Play, X } from "lucide-react";
import { AfricaIncomingPhone, type IncomingPhoneState } from "@/lib/africa-incoming-phone";

const departments = [["sales", "Sales"], ["support", "Support"], ["onboarding", "Onboarding"], ["customer_support", "General enquiries"]];
export function AfricaBrowserPhone() {
  const phone = useRef<AfricaIncomingPhone | null>(null);
  const enabled = useRef(false);
  const outbound = useRef(false);
  const [open, setOpen] = useState(false);
  const [queues, setQueues] = useState(["customer_support"]);
  const selected = useRef(queues);
  useEffect(() => { selected.current = queues; }, [queues]);
  const [state, setState] = useState<IncomingPhoneState>({ state: "off", call: null, error: null, held: false, muted: false, audioBlocked: false });
  useEffect(() => {
    const current = new AfricaIncomingPhone(value => { setState(value); if (value.state === "ringing") setOpen(true); });
    phone.current = current;
    const pause = (event: Event) => {
      const wait = (event as CustomEvent<{ waitUntil: (promise: Promise<void>) => void }>).detail?.waitUntil;
      if (["ringing", "active"].includes(current.snapshot.state)) {
        wait?.(Promise.reject(new Error("Finish or decline your incoming telephone call first.")));
        return;
      }
      outbound.current = true;
      wait?.(current.stop());
    };
    const resume = () => { outbound.current = false; if (enabled.current) void current.start(selected.current); };
    const close = () => { enabled.current = false; void current.stop(); };
    window.addEventListener("azera:outbound-start", pause);
    window.addEventListener("azera:outbound-end", resume);
    window.addEventListener("pagehide", close);
    return () => {
      enabled.current = false;
      window.removeEventListener("azera:outbound-start", pause);
      window.removeEventListener("azera:outbound-end", resume);
      window.removeEventListener("pagehide", close);
      void current.stop(); phone.current = null;
    };
  }, []);
  const inCall = ["ringing", "active"].includes(state.state);
  const connected = ["connecting", "ready", "ringing", "active"].includes(state.state);
  return <div className="relative">
    <button type="button" aria-label="Browser phone" aria-expanded={open} onClick={() => setOpen(!open)} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border ${state.state === "ready" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-700"}`}>
      <Phone className="h-4 w-4" />{inCall && <span className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full bg-retail" />}
    </button>
    {open && <section aria-label="Incoming browser phone" className="fixed inset-x-3 top-20 z-[90] max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">Browser phone</h2><button aria-label="Minimise phone" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
      <p role="status" className="mt-2 text-sm text-slate-700">{state.state === "ready" ? "Ready for incoming calls" : state.state === "connecting" ? "Connecting your phone…" : state.state === "ringing" ? "Incoming telephone call" : state.state === "active" ? "Call connected" : "Phone offline"}</p>
      {state.error && <p role="alert" className="mt-2 break-words text-sm text-red-700">{state.error}</p>}
      {inCall ? <div className="mt-3 space-y-3">
        <p className="break-words text-sm font-medium text-slate-900">{state.call?.customer_phone || "Loading caller…"}</p>
        {state.state === "ringing" ? <button disabled={!state.call} onClick={() => void phone.current?.answer()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-3 text-sm text-white disabled:opacity-50"><PhoneIncoming className="h-4 w-4" />Answer call</button> : <>
          <div className="flex gap-2"><button onClick={() => phone.current?.mute()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{state.muted ? "Unmute" : "Mute"}</button><button onClick={() => phone.current?.hold()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.held ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{state.held ? "Resume" : "Hold"}</button></div>
          <div aria-label="Phone keypad" className="grid grid-cols-3 gap-1">{"123456789*0#".split("").map(digit => <button key={digit} onClick={() => phone.current?.dtmf(digit)} className="min-h-9 rounded-lg bg-slate-50 text-sm">{digit}</button>)}</div>
        </>}
        {state.audioBlocked && <button onClick={() => void phone.current?.resumeAudio()} className="w-full rounded-lg bg-blue-50 p-2 text-sm text-blue-700">Tap to hear the call</button>}
        <button onClick={() => void phone.current?.end()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 text-sm text-red-700"><PhoneOff className="h-4 w-4" />{state.state === "ringing" ? "Decline" : "End call"}</button>
      </div> : <div className="mt-3 space-y-3">
        <fieldset disabled={connected} className="space-y-2"><legend className="mb-2 text-xs font-medium text-slate-600">Receive calls for</legend>{departments.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={queues.includes(key)} onChange={event => setQueues(old => event.target.checked ? [...old, key] : old.filter(value => value !== key))} />{label}</label>)}</fieldset>
        <button disabled={state.state === "connecting" || (!connected && !queues.length)} onClick={() => { enabled.current = !connected; if (connected) void phone.current?.stop(); else if (!outbound.current) void phone.current?.start(queues); }} className="min-h-11 w-full rounded-xl bg-retail px-3 text-sm font-medium text-white disabled:opacity-50">{connected ? "Go offline" : "Enable browser phone"}</button>
        <p className="text-xs leading-5 text-slate-500">Keep this tab open. Calls continue while you navigate the admin portal. Microphone permission is required. Only one tab can receive calls.</p>
      </div>}
    </section>}
  </div>;
}
