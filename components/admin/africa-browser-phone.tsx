"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Phone, PhoneIncoming, PhoneOff, Mic, MicOff, Pause, Play, X, ArrowRightLeft, Users } from "lucide-react";
import { AfricaIncomingPhone, type IncomingPhoneState } from "@/lib/africa-incoming-phone";
import { normalizeDialNumber, type BrowserDialRequest } from "@/lib/browser-phone-target";
import { AzeraOutboundCall, type OutboundContact } from "@/components/admin/azera-outbound-call";

const departments = [["sales", "Sales"], ["support", "Support"], ["onboarding", "Onboarding"], ["customer_support", "General enquiries"]] as const;
const MANUAL_OFF_KEY = "martpoint.azeraBrowserPhone.manuallyOffline";
export function AfricaBrowserPhone() {
  const phone = useRef<AfricaIncomingPhone | null>(null);
  const enabled = useRef(false);
  const outbound = useRef(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"dial" | "receive">("receive");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [context, setContext] = useState<BrowserDialRequest | null>(null);
  const [outgoing, setOutgoing] = useState<OutboundContact | null>(null);
  const [outboundBusy, setOutboundBusy] = useState(false);
  const [dialError, setDialError] = useState("");
  const [controlQueue, setControlQueue] = useState("support");
  const [controlBusy, setControlBusy] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const [queues, setQueues] = useState<string[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState("");
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; width: number; height: number } | null>(null);
  const selected = useRef(queues);
  useEffect(() => { selected.current = queues; }, [queues]);
  const [state, setState] = useState<IncomingPhoneState>({ state: "off", call: null, error: null, held: false, muted: false, audioBlocked: false });
  const loadAssignment = useCallback(async () => {
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const response = await fetch("/api/azera/calls/africa-browser/agent", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load voice assignment.");
      const assigned = Array.isArray(data.allowedQueues) ? data.allowedQueues : [];
      setQueues(assigned);
      selected.current = assigned;
      if (!assigned.length) setAssignmentError("No voice queues are assigned to your account for this business.");

      let manuallyOffline = false;
      try { manuallyOffline = sessionStorage.getItem(MANUAL_OFF_KEY) === "1"; } catch { /* storage may be disabled */ }
      const currentState = phone.current?.snapshot;
      if (!manuallyOffline && assigned.length && phone.current &&
        (currentState?.state === "off" || (currentState?.state === "error" && !currentState.retrying))) {
        enabled.current = true;
        void phone.current.start(assigned);
      }
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : "Could not load voice assignment.");
    } finally {
      setAssignmentLoading(false);
    }
  }, []);
  useEffect(() => {
    const current = new AfricaIncomingPhone(value => {
      setState(value);
      if (value.state === "ringing") setOpen(true);
      if (value.state === "error" && !value.retrying) {
        enabled.current = false;
        setOpen(true);
      }
    });
    phone.current = current;
    const assignmentTimer = window.setTimeout(() => { void loadAssignment(); }, 0);
    const pause = (event: Event) => {
      const wait = (event as CustomEvent<{ waitUntil: (promise: Promise<void>) => void }>).detail?.waitUntil;
      if (["ringing", "active"].includes(current.snapshot.state)) {
        wait?.(Promise.reject(new Error("Finish or decline your incoming telephone call first.")));
        return;
      }
      if (outbound.current) {
        wait?.(Promise.reject(new Error("Finish the current outgoing call first.")));
        return;
      }
      outbound.current = true;
      setOutboundBusy(true);
      wait?.(current.stop(true).catch(error => { outbound.current = false; setOutboundBusy(false); throw error; }));
    };
    const resume = () => { outbound.current = false; setOutboundBusy(false); if (enabled.current) void current.start(selected.current); };
    const prepareDial = (event: Event) => {
      const detail = (event as CustomEvent<BrowserDialRequest>).detail;
      if (!detail?.target || typeof detail.phone !== "string" || typeof detail.name !== "string") return;
      setOpen(true); setTab("dial");
      if (outbound.current || ["ringing", "active"].includes(current.snapshot.state)) {
        setDialError("Finish or decline the current call before calling a creator."); return;
      }
      setNumber(detail.phone); setName(detail.name); setContext(detail); setDialError("");
    };
    const close = () => { void current.stop(true); };
    const restore = () => {
      let manuallyOffline = false;
      try { manuallyOffline = sessionStorage.getItem(MANUAL_OFF_KEY) === "1"; } catch { /* storage may be disabled */ }
      if (!manuallyOffline && selected.current.length && !outbound.current && current.snapshot.state === "off") {
        enabled.current = true;
        void current.start(selected.current);
      }
    };
    const visible = () => { if (document.visibilityState === "visible") restore(); };
    window.addEventListener("azera:outbound-start", pause);
    window.addEventListener("azera:outbound-end", resume);
    window.addEventListener("azera:dial", prepareDial);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visible);
    return () => {
      enabled.current = false;
      window.clearTimeout(assignmentTimer);
      window.removeEventListener("azera:outbound-start", pause);
      window.removeEventListener("azera:outbound-end", resume);
      window.removeEventListener("azera:dial", prepareDial);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visible);
      void current.stop(true); phone.current = null;
    };
  }, [loadAssignment]);
  const inCall = ["ringing", "active"].includes(state.state);
  const connected = ["connecting", "ready", "ringing", "active"].includes(state.state);
  const beginPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = event.currentTarget.closest("section");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanelPosition({ left: rect.left, top: rect.top });
    event.preventDefault();
  };
  const movePanel = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setPanelPosition({
      left: Math.max(8, Math.min(window.innerWidth - active.width - 8, active.left + event.clientX - active.x)),
      top: Math.max(8, Math.min(window.innerHeight - active.height - 8, active.top + event.clientY - active.y)),
    });
  };
  const endPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const dial = () => {
      if (inCall || outbound.current || outboundBusy || outgoing) { setDialError("Finish the current call first."); return; }
    const phoneNumber = normalizeDialNumber(number);
    if (!phoneNumber) { setDialError("Enter a full phone number, for example +2348012345678. Nigerian 080… numbers are also accepted."); return; }
    setDialError("");
    setOutgoing({ id: `manual-${Date.now()}`, name: name.trim() || "Phone call", phone: phoneNumber, target: context?.target || { phone: phoneNumber, name: name.trim() } });
    setOpen(false);
  };
  const requestControl = async (mode: "transfer" | "conference") => {
    if (!state.call?.id || state.state !== "active") return;
    setControlBusy(true); setControlMessage("");
    try {
      const response = await fetch(`/api/azera/calls/${state.call.id}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, queue: controlQueue }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare call control.");
      phone.current?.dtmf(data.controlDigit);
      setControlMessage(data.message || "Control request sent.");
    } catch (error) { setControlMessage(error instanceof Error ? error.message : "Could not prepare call control."); }
    finally { setControlBusy(false); }
  };
  return <div className="relative">
    <button type="button" aria-label={`Softphone: ${state.state === "ready" ? "available" : inCall ? "call in progress" : "offline"}`} aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) void loadAssignment(); }} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${state.state === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : inCall ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"}`}>
      <Phone className="h-4 w-4" />{(inCall || state.state === "ready") && <span className={`absolute right-0 top-0 h-3 w-3 rounded-full ring-2 ring-white ${inCall ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />}
    </button>
    {open && <section aria-label="Softphone" style={panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: "auto" } : undefined} className="fixed right-3 top-20 z-[90] max-h-[calc(100dvh-6rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[1.6rem] border border-indigo-100 bg-slate-50 shadow-[0_24px_70px_rgba(34,42,145,0.28)]">
      <div onPointerDown={beginPanelDrag} onPointerMove={movePanel} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag} style={{ touchAction: "none" }} className="relative flex cursor-move items-center justify-between gap-3 overflow-hidden bg-gradient-to-br from-[#3037b1] via-[#4654d5] to-[#737cf4] px-5 py-4 text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/10" />
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/20"><Phone className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-100">MartPoint Voice</p><h2 className="mt-0.5 text-lg font-semibold tracking-tight">Softphone</h2></div></div>
        <button type="button" aria-label="Minimise phone" onPointerDown={event => event.stopPropagation()} onClick={() => setOpen(false)} className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4 p-4">
      <div role="status" className={`relative overflow-hidden rounded-[1.35rem] p-4 text-white shadow-lg ${inCall ? "bg-gradient-to-br from-[#2642b8] via-[#3b58d5] to-[#6984ff]" : state.state === "ready" ? "bg-gradient-to-br from-[#3037b1] via-[#4856d6] to-[#737df4]" : "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"}`}>
        <div className="pointer-events-none absolute -right-7 -top-10 h-36 w-36 rounded-full border-[20px] border-white/10" />
        <div className="relative flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{inCall ? "Live call" : "Your availability"}</p><p className="mt-1 text-xl font-semibold tracking-tight">{outboundBusy || outgoing ? "Calling out" : state.retrying ? "Reconnecting" : state.state === "ready" ? "You're available" : state.state === "connecting" ? "Getting your phone ready" : state.state === "ringing" ? "Incoming call" : state.state === "active" ? "Call connected" : state.state === "error" ? "Needs attention" : "Phone is offline"}</p><p className="mt-1 text-xs text-white/75">{inCall ? "Answer and manage your conversation" : state.state === "ready" ? "Listening for calls on your queues" : state.state === "connecting" ? "Keep this tab open for a moment" : "Your assigned queues appear below"}</p></div><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] ring-1 ring-white/25 ${inCall ? "bg-white/20" : state.state === "ready" ? "bg-emerald-400/20" : "bg-white/10"}`}><Phone className="h-6 w-6" /></span></div>
        {!inCall && <div className="relative mt-4 flex flex-wrap gap-1.5">{assignmentLoading ? <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white/80">Checking your queues…</span> : queues.length ? queues.map(queue => <span key={queue} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/10">{departments.find(([key]) => key === queue)?.[1] || queue}</span>) : <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white/80">No queues assigned</span>}</div>}
      </div>
      {state.error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p className="break-words">{state.error}</p>{/active|ringing|Call Reports/i.test(state.error) && <a href="/admin/azera/reports" className="mt-1 inline-flex font-medium text-blue-700 underline">Open Azera Call Reports</a>}</div>}
      {inCall ? <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-sm"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><PhoneIncoming className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-500">{state.call?.selected_department || "Assigned queue"}</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{state.call?.caller?.name || state.call?.customer_phone || "Loading caller…"}</p>{state.call?.caller?.businessName && <p className="mt-0.5 truncate text-xs text-slate-500">{state.call.caller.businessName} · {state.call.customer_phone}</p>}</div></div>
        {state.state === "ringing" ? <button disabled={!state.call} onClick={() => void phone.current?.answer()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-3 text-sm text-white disabled:opacity-50"><PhoneIncoming className="h-4 w-4" />Answer call</button> : <>
          <div className="flex gap-2"><button onClick={() => phone.current?.mute()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{state.muted ? "Unmute" : "Mute"}</button><button onClick={() => phone.current?.hold()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.held ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{state.held ? "Resume" : "Hold"}</button></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Send this call to another queue</p><select value={controlQueue} onChange={event => setControlQueue(event.target.value)} disabled={controlBusy} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">{departments.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div className="mt-2 flex gap-2"><button type="button" disabled={controlBusy} onClick={() => void requestControl("transfer")} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 text-sm text-blue-800 disabled:opacity-50"><ArrowRightLeft className="h-4 w-4" />Transfer</button><button type="button" disabled={controlBusy} onClick={() => void requestControl("conference")} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border text-sm text-slate-700 disabled:opacity-50"><Users className="h-4 w-4" />Conference</button></div>{controlMessage && <p role="status" className="mt-2 text-xs leading-5 text-slate-600">{controlMessage}</p>}</div>
          <div aria-label="Phone keypad" className="grid grid-cols-3 gap-1">{"123456789*0#".split("").map(digit => <button key={digit} onClick={() => phone.current?.dtmf(digit)} className="min-h-9 rounded-lg bg-slate-50 text-sm">{digit}</button>)}</div>
        </>}
        {state.audioBlocked && <button onClick={() => void phone.current?.resumeAudio()} className="w-full rounded-lg bg-blue-50 p-2 text-sm text-blue-700">Tap to hear the call</button>}
        <button onClick={() => void phone.current?.end()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-medium text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100"><PhoneOff className="h-4 w-4" />{state.state === "ringing" ? "Decline call" : "End call"}</button>
      </div> : <div className="space-y-4">
        <div className="flex gap-1 rounded-2xl border border-indigo-100 bg-white p-1 shadow-sm" aria-label="Phone mode"><button type="button" aria-pressed={tab === "receive"} onClick={() => setTab("receive")} className={`min-h-10 flex-1 rounded-xl text-sm font-semibold transition ${tab === "receive" ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/15" : "text-slate-500 hover:bg-slate-50"}`}>Receive calls</button><button type="button" aria-pressed={tab === "dial"} onClick={() => setTab("dial")} className={`min-h-10 flex-1 rounded-xl text-sm font-semibold transition ${tab === "dial" ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/15" : "text-slate-500 hover:bg-slate-50"}`}>Dial pad</button></div>
        {tab === "dial" ? <form className="space-y-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm" onSubmit={event => { event.preventDefault(); dial(); }}>
          <label className="block text-xs font-semibold text-slate-600">Contact name <span className="font-normal text-slate-400">(optional)</span><input value={name} maxLength={120} disabled={!!context || outboundBusy || !!outgoing} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
          <label className="block text-xs font-semibold text-slate-600">Phone number<input type="tel" inputMode="tel" autoComplete="tel" value={number} maxLength={40} readOnly={!!context} disabled={outboundBusy || !!outgoing} onChange={event => { setNumber(event.target.value); setDialError(""); }} placeholder="+234 801 234 5678" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
          {context ? <div className="text-xs leading-5 text-slate-500">This contact’s saved number will be loaded securely when calling. <button type="button" className="font-semibold text-indigo-700 underline" onClick={() => { setContext(null); setNumber(""); setName(""); }}>Dial a different number</button></div> : <div aria-label="Dial pad" className="grid grid-cols-3 gap-2">{"123456789+0".split("").map(digit => <button type="button" key={digit} disabled={outboundBusy || !!outgoing} onClick={() => setNumber(value => value.length < 40 ? value + digit : value)} className="min-h-11 rounded-xl border border-slate-100 bg-slate-50 text-base font-semibold text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700">{digit}</button>)}<button type="button" disabled={outboundBusy || !!outgoing} aria-label="Delete last digit" onClick={() => setNumber(value => value.slice(0, -1))} className="min-h-11 rounded-xl border border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-slate-100">Delete</button></div>}
          {dialError && <p role="alert" className="text-sm text-red-700">{dialError}</p>}
          <p className="text-xs leading-5 text-slate-600">Calls use your browser microphone and Africa’s Talking balance—not FaceTime. Supported destinations depend on your provider account. Check the number before calling.</p>
          <button type="submit" disabled={!number.trim() || outboundBusy || !!outgoing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50"><Phone className="h-4 w-4" />Call {context ? name : "number"}</button>
        </form> : <>
        {!queues.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{assignmentLoading ? "Checking your assignment…" : assignmentError || "No queues assigned. Ask an administrator to enable your voice access."}</div>}
        {!queues.length && !assignmentLoading && <button type="button" onClick={() => void loadAssignment()} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50">Check assignment again</button>}
        <button disabled={assignmentLoading || outboundBusy || !!outgoing || state.state === "connecting" || inCall || (!connected && !state.retrying && !queues.length)} onClick={() => { if (connected || state.retrying) { enabled.current = false; try { sessionStorage.setItem(MANUAL_OFF_KEY, "1"); } catch { /* storage may be disabled */ } void phone.current?.stop(); } else if (!outbound.current) { enabled.current = true; try { sessionStorage.removeItem(MANUAL_OFF_KEY); } catch { /* storage may be disabled */ } void phone.current?.start(queues); } }} className={`min-h-12 w-full rounded-2xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${connected || state.retrying ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-700 hover:to-blue-700"}`}>{inCall ? "Finish the call to go offline" : connected || state.retrying ? "Go offline" : state.error ? "Retry connection" : "Turn phone on"}</button>
        <p className="text-center text-[11px] leading-5 text-slate-500">Auto-connects after sign in. Keep this tab open to receive calls. Microphone access is required. Only one tab can receive calls at a time.</p>
        </>}
      </div>}
      </div>
    </section>}
    {outgoing && <AzeraOutboundCall contact={outgoing} onClosed={() => setOutgoing(null)} />}
  </div>;
}
