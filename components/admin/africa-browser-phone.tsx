"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Phone, PhoneIncoming, PhoneOff, Mic, MicOff, Pause, Play, X, ArrowRightLeft, Users } from "lucide-react";
import { AfricaIncomingPhone, type IncomingPhoneState } from "@/lib/africa-incoming-phone";
import { normalizeDialNumber, type BrowserDialRequest } from "@/lib/browser-phone-target";
import { AzeraOutboundCall, type OutboundContact } from "@/components/admin/azera-outbound-call";

const departments = [["sales", "Sales"], ["support", "Support"], ["onboarding", "Onboarding"], ["customer_support", "General enquiries"]] as const;
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
  useEffect(() => {
    const current = new AfricaIncomingPhone(value => { setState(value); if (value.state === "ringing") setOpen(true); });
    phone.current = current;
    void fetch("/api/azera/calls/africa-browser/agent", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load voice assignment.");
        const assigned = Array.isArray(data.allowedQueues) ? data.allowedQueues : [];
        setQueues(assigned);
        selected.current = assigned;
        if (!assigned.length) setAssignmentError("You are not assigned to a voice queue.");
      })
      .catch(error => setAssignmentError(error instanceof Error ? error.message : "Could not load voice assignment."))
      .finally(() => setAssignmentLoading(false));
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
      wait?.(current.stop().catch(error => { outbound.current = false; setOutboundBusy(false); throw error; }));
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
    const close = () => { enabled.current = false; void current.stop(); };
    window.addEventListener("azera:outbound-start", pause);
    window.addEventListener("azera:outbound-end", resume);
    window.addEventListener("azera:dial", prepareDial);
    window.addEventListener("pagehide", close);
    return () => {
      enabled.current = false;
      window.removeEventListener("azera:outbound-start", pause);
      window.removeEventListener("azera:outbound-end", resume);
      window.removeEventListener("azera:dial", prepareDial);
      window.removeEventListener("pagehide", close);
      void current.stop(); phone.current = null;
    };
  }, []);
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
    <button type="button" aria-label="Browser phone" aria-expanded={open} onClick={() => setOpen(!open)} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border ${state.state === "ready" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-700"}`}>
      <Phone className="h-4 w-4" />{inCall && <span className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full bg-retail" />}
    </button>
    {open && <section aria-label="Browser phone controls" style={panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: "auto" } : undefined} className="fixed right-3 top-20 z-[90] max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div onPointerDown={beginPanelDrag} onPointerMove={movePanel} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag} style={{ touchAction: "none" }} className="flex cursor-move items-center justify-between gap-2 rounded-lg pb-1">
        <div><h2 className="text-sm font-semibold text-slate-900">Browser phone</h2><p className="text-[10px] text-slate-400">Drag to move</p></div>
        <button type="button" aria-label="Minimise phone" onPointerDown={event => event.stopPropagation()} onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-700">{outboundBusy || outgoing ? "Outgoing call in progress" : state.state === "ready" ? "Ready for incoming calls" : state.state === "connecting" ? "Connecting your phone…" : state.state === "ringing" ? "Incoming telephone call" : state.state === "active" ? "Call connected" : "Incoming phone offline"}</p>
      {state.error && <div role="alert" className="mt-2 space-y-1 break-words text-sm text-red-700"><p>{state.error}</p>{/active|ringing|Call Reports/i.test(state.error) && <a href="/admin/azera/reports" className="inline-flex font-medium text-blue-700 underline">Open Azera Call Reports</a>}</div>}
      {inCall ? <div className="mt-3 space-y-3">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">{state.call?.selected_department || "Assigned queue"}</p><p className="mt-1 break-words text-sm font-medium text-slate-900">{state.call?.caller?.name || state.call?.customer_phone || "Loading caller…"}</p>{state.call?.caller?.businessName && <p className="mt-1 break-words text-xs text-slate-600">{state.call.caller.businessName} · {state.call.customer_phone}</p>}</div>
        {state.state === "ringing" ? <button disabled={!state.call} onClick={() => void phone.current?.answer()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-3 text-sm text-white disabled:opacity-50"><PhoneIncoming className="h-4 w-4" />Answer call</button> : <>
          <div className="flex gap-2"><button onClick={() => phone.current?.mute()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{state.muted ? "Unmute" : "Mute"}</button><button onClick={() => phone.current?.hold()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm">{state.held ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{state.held ? "Resume" : "Hold"}</button></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Send this call to another queue</p><select value={controlQueue} onChange={event => setControlQueue(event.target.value)} disabled={controlBusy} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">{departments.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div className="mt-2 flex gap-2"><button type="button" disabled={controlBusy} onClick={() => void requestControl("transfer")} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 text-sm text-blue-800 disabled:opacity-50"><ArrowRightLeft className="h-4 w-4" />Transfer</button><button type="button" disabled={controlBusy} onClick={() => void requestControl("conference")} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border text-sm text-slate-700 disabled:opacity-50"><Users className="h-4 w-4" />Conference</button></div>{controlMessage && <p role="status" className="mt-2 text-xs leading-5 text-slate-600">{controlMessage}</p>}</div>
          <div aria-label="Phone keypad" className="grid grid-cols-3 gap-1">{"123456789*0#".split("").map(digit => <button key={digit} onClick={() => phone.current?.dtmf(digit)} className="min-h-9 rounded-lg bg-slate-50 text-sm">{digit}</button>)}</div>
        </>}
        {state.audioBlocked && <button onClick={() => void phone.current?.resumeAudio()} className="w-full rounded-lg bg-blue-50 p-2 text-sm text-blue-700">Tap to hear the call</button>}
        <button onClick={() => void phone.current?.end()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 text-sm text-red-700"><PhoneOff className="h-4 w-4" />{state.state === "ringing" ? "Decline" : "End call"}</button>
      </div> : <div className="mt-3 space-y-3">
        <div className="flex gap-2" aria-label="Phone mode"><button type="button" aria-pressed={tab === "dial"} onClick={() => setTab("dial")} className={`min-h-10 flex-1 rounded-lg border text-sm ${tab === "dial" ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}>Make a call</button><button type="button" aria-pressed={tab === "receive"} onClick={() => setTab("receive")} className={`min-h-10 flex-1 rounded-lg border text-sm ${tab === "receive" ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}>Receive calls</button></div>
        {tab === "dial" ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); dial(); }}>
          <label className="block text-xs font-medium text-slate-700">Contact name (optional)<input value={name} maxLength={120} disabled={!!context || outboundBusy || !!outgoing} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>
          <label className="block text-xs font-medium text-slate-700">Phone number<input type="tel" inputMode="tel" autoComplete="tel" value={number} maxLength={40} readOnly={!!context} disabled={outboundBusy || !!outgoing} onChange={event => { setNumber(event.target.value); setDialError(""); }} placeholder="+2348012345678" className="mt-1 w-full rounded-lg border p-2 text-base" /></label>
          {context ? <div className="text-xs text-slate-600">This creator’s saved number will be loaded securely when calling. <button type="button" className="font-medium text-blue-700 underline" onClick={() => { setContext(null); setNumber(""); setName(""); }}>Dial a different number</button></div> : <div aria-label="Dial pad" className="grid grid-cols-3 gap-1">{"123456789+0".split("").map(digit => <button type="button" key={digit} disabled={outboundBusy || !!outgoing} onClick={() => setNumber(value => value.length < 40 ? value + digit : value)} className="min-h-11 rounded-lg bg-slate-50 text-base text-slate-800">{digit}</button>)}<button type="button" disabled={outboundBusy || !!outgoing} aria-label="Delete last digit" onClick={() => setNumber(value => value.slice(0, -1))} className="min-h-11 rounded-lg bg-slate-50 text-sm">Delete</button></div>}
          {dialError && <p role="alert" className="text-sm text-red-700">{dialError}</p>}
          <p className="text-xs leading-5 text-slate-600">Calls use your browser microphone and Africa’s Talking balance—not FaceTime. Supported destinations depend on your provider account. Check the number before calling.</p>
          <button type="submit" disabled={!number.trim() || outboundBusy || !!outgoing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-retail px-3 text-sm font-medium text-white disabled:opacity-50"><Phone className="h-4 w-4" />Call {context ? name : "number"}</button>
        </form> : <>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned queues</p>{assignmentLoading ? <p className="mt-1 text-sm text-slate-600">Loading assignment…</p> : queues.length ? <p className="mt-1 text-sm text-slate-800">{queues.map(queue => departments.find(([key]) => key === queue)?.[1] || queue).join(", ")}</p> : <p className="mt-1 text-sm text-amber-700">No queues assigned. Ask an administrator to enable your voice access.</p>}</div>
        {assignmentError && <p role="alert" className="text-sm text-amber-700">{assignmentError}</p>}
        <button disabled={assignmentLoading || outboundBusy || !!outgoing || state.state === "connecting" || (!connected && !queues.length)} onClick={() => { enabled.current = !connected; if (connected) void phone.current?.stop(); else if (!outbound.current) void phone.current?.start(queues); }} className="min-h-11 w-full rounded-xl bg-retail px-3 text-sm font-medium text-white disabled:opacity-50">{connected ? "Go offline" : "Enable browser phone"}</button>
        <p className="text-xs leading-5 text-slate-500">Your queues are assigned by an administrator; this browser cannot opt itself into another department. Keep this tab open. Calls continue while you navigate the admin portal. Microphone permission is required. Only one tab can receive calls. Use Go offline before switching tabs; minimising this panel keeps it connected.</p>
        </>}
      </div>}
    </section>}
    {outgoing && <AzeraOutboundCall contact={outgoing} onClosed={() => setOutgoing(null)} />}
  </div>;
}
