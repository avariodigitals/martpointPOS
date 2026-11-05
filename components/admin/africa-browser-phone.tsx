"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Phone, PhoneIncoming, PhoneOff, Mic, MicOff, Pause, Play, X, ArrowRightLeft, Users, Home, MessageSquare, ContactRound, Settings, BarChart3, Megaphone, Headphones, Search, RefreshCw, ChevronDown, Mail } from "lucide-react";
import { AfricaIncomingPhone, type IncomingPhoneState } from "@/lib/africa-incoming-phone";
import { normalizeDialNumber, normalizeSipAddress, type BrowserDialRequest } from "@/lib/browser-phone-target";
import { AzeraOutboundCall, type OutboundContact } from "@/components/admin/azera-outbound-call";
import { AssignedVoiceCampaigns } from "@/components/admin/assigned-voice-campaigns";
import { MediaCallWorkspace } from "@/components/admin/media-call-workspace"
import { AdminAvatar } from "@/components/admin/admin-avatar";

const departments = [["sales", "Sales"], ["support", "Support"], ["onboarding", "Onboarding"], ["customer_support", "General enquiries"]] as const;
const REPORT_RANGES = [{ id: "today", label: "Today" }, { id: "last_7_days", label: "Last 7 days" }, { id: "this_month", label: "This month" }, { id: "last_month", label: "Last month" }, { id: "last_30_days", label: "Last 30 days" }, { id: "this_year", label: "This year" }] as const;
function semiPoint(ratio: number) {
  const angle = Math.PI * (1 - Math.max(0, Math.min(1, ratio)));
  return { x: 120 + 92 * Math.cos(angle), y: 124 - 92 * Math.sin(angle) };
}
type PhonebookContact = { id: string; name: string; phone: string; email: string | null; group: string; groupId: string; source: "marketing" | "lead" | "business" | "creator" | "partner" | "partner_lead"; linkedLeadId?: string | null };
type ContactThread = { kind: "message" | "email"; contact: PhonebookContact };
type ContactThreadData = {
  emails?: { id: string; direction: string; fromEmail?: string | null; toEmail?: string | null; subject?: string; bodyText?: string; bodyHtml?: string; createdAt?: string }[];
  conversations?: { id: string; channel: string; customer_name: string | null; last_message_at: string }[];
  messages?: { id: string; direction?: string; author_type?: string; message: string; created_at: string; status?: string }[];
};
type Workspace = {
  calls: { id: string; lead_id: string | null; direction: string; status: string; customer_name: string | null; customer_phone: string | null; duration_seconds: number | null; created_at: string }[];
  callStats: { total: number; inbound: number; outbound: number; missed: number; minutes: number; inboundMinutes: number; outboundMinutes: number; unansweredPercent: number };
  period: string;
  phonebook: { groups: { id: string; name: string; count: number }[]; contacts: PhonebookContact[] };
};
export function AfricaBrowserPhone({ userName }: { userName: string }) {
  const phone = useRef<AfricaIncomingPhone | null>(null);
  const enabled = useRef(false);
  const outbound = useRef(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<"dial" | "receive">("receive");
  const [appTab, setAppTab] = useState<"home" | "messages" | "people" | "settings">("home");
  const [settingsPanel, setSettingsPanel] = useState<"voice" | "supervisor" | null>(null);
  const [showAllCalls, setShowAllCalls] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [contactThread, setContactThread] = useState<ContactThread | null>(null);
  const [threadData, setThreadData] = useState<ContactThreadData | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [searchContacts, setSearchContacts] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [dateRange, setDateRange] = useState("this_month");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [dialSearch, setDialSearch] = useState("");
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
  const loadWorkspace = useCallback(async () => {
    setWorkspaceError("");
    try {
      const response = await fetch(`/api/azera/softphone?period=${dateRange}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Phone workspace could not load.");
      setWorkspace(data as Workspace);
    } catch (error) { setWorkspaceError(error instanceof Error ? error.message : "Phone workspace could not load."); }
  }, [dateRange]);
  const loadAssignment = useCallback(async () => {
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const response = await fetch("/api/azera/calls/africa-browser/agent", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not check your phone assignment. Please try again.");
      if (!data) throw new Error("Could not check your phone assignment. Please try again.");
      const assigned = Array.isArray(data.allowedQueues) ? data.allowedQueues : [];
      setQueues(assigned);
      selected.current = assigned;
      if (!assigned.length) setAssignmentError("No voice queues are assigned to your account for this business.");

    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : "Could not load voice assignment.");
    } finally {
      setAssignmentLoading(false);
    }
  }, []);
  useEffect(() => {
    const current = new AfricaIncomingPhone(value => {
      setState(value);
      if (value.state === "ringing") { setClosing(false); setOpen(true); setAppTab("home"); }
      if (value.state === "error" && !value.retrying) {
        enabled.current = false;
        setClosing(false); setOpen(true);
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
      setClosing(false); setOpen(true); setTab("dial");
      if (outbound.current || ["ringing", "active"].includes(current.snapshot.state)) {
        setDialError("Finish or decline the current call before calling a creator."); return;
      }
      setNumber(detail.phone); setName(detail.name); setContext(detail); setDialError("");
    };
    const close = () => { enabled.current = false; void current.stop(true); };
    window.addEventListener("azera:outbound-start", pause);
    window.addEventListener("azera:outbound-end", resume);
    window.addEventListener("azera:dial", prepareDial);
    window.addEventListener("pagehide", close);
    return () => {
      enabled.current = false;
      window.clearTimeout(assignmentTimer);
      window.removeEventListener("azera:outbound-start", pause);
      window.removeEventListener("azera:outbound-end", resume);
      window.removeEventListener("azera:dial", prepareDial);
      window.removeEventListener("pagehide", close);
      void current.stop(true); phone.current = null;
    };
  }, [loadAssignment]);
  const minimizePhone = () => setClosing(true);
  const inCall = ["ringing", "active"].includes(state.state);
  const connected = ["connecting", "ready", "ringing", "active"].includes(state.state);
  const callMinutes = workspace?.callStats.minutes || 0;
  const inboundShare = callMinutes ? (workspace?.callStats.inboundMinutes || 0) / callMinutes : 0;
  const inboundEnd = semiPoint(inboundShare);
  const outboundStart = semiPoint(Math.min(1, inboundShare + 0.035));
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [open, loadWorkspace]);
  const filteredContacts = workspace?.phonebook.contacts.filter(contact => (selectedGroup === "all" || contact.groupId === selectedGroup) && `${contact.name} ${contact.phone} ${contact.email || ""} ${contact.group}`.toLowerCase().includes(searchContacts.toLowerCase())) || [];
  const filteredDialContacts = dialSearch.trim() ? (workspace?.phonebook.contacts || []).filter(contact => contact.phone && `${contact.name} ${contact.phone}`.toLowerCase().includes(dialSearch.trim().toLowerCase())).slice(0, 6) : [];
  const openContactThread = (kind: ContactThread["kind"], contact: PhonebookContact) => {
    setContactThread({ kind, contact }); setThreadData(null); setThreadError(""); setThreadLoading(true); setAppTab("messages");
  };
  useEffect(() => {
    if (!contactThread) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ kind: contactThread.kind, source: contactThread.contact.source, id: contactThread.contact.id });
    void fetch(`/api/azera/softphone/threads?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || "Thread could not load."); return data as ContactThreadData; })
      .then(data => { if (!controller.signal.aborted) setThreadData(data); })
      .catch(error => { if (!controller.signal.aborted) setThreadError(error instanceof Error ? error.message : "Thread could not load."); })
      .finally(() => { if (!controller.signal.aborted) setThreadLoading(false); });
    return () => controller.abort();
  }, [contactThread]);
  const beginPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return;
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
    const sipAddress = normalizeSipAddress(number);
    const phoneNumber = normalizeDialNumber(number);
    if (!sipAddress && !phoneNumber) { setDialError("Enter a phone number or SIP address, for example sip:agent@provider.example."); return; }
    setDialError("");
    const contactName = name.trim() || (sipAddress ? sipAddress : "Phone call");
    setOutgoing({ id: `manual-${Date.now()}`, name: contactName, phone: sipAddress || phoneNumber!, target: context?.target || (sipAddress ? { sipAddress, name: contactName } : { phone: phoneNumber!, name: contactName }) });
    minimizePhone();
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
    <button type="button" aria-label={`${open ? "Minimise" : "Open"} softphone${state.state === "ready" ? ": available" : inCall ? ": call in progress" : ": offline"}`} aria-expanded={open && !closing} onClick={() => { if (open) { minimizePhone(); return; } setClosing(false); setOpen(true); void loadAssignment(); }} className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3037b1] to-[#6576ed] text-white shadow-md shadow-indigo-900/20 ring-1 ring-white/80 transition hover:scale-105 hover:shadow-lg ${inCall ? "ring-2 ring-blue-300" : ""}`}>
      <Phone className="h-[18px] w-[18px]" />{(inCall || state.state === "ready") && <span className={`absolute right-0 top-0 h-3 w-3 rounded-full ring-2 ring-white ${inCall ? "animate-pulse bg-blue-500" : "bg-emerald-400"}`} />}
    </button>
    {open && <section aria-label="Softphone" aria-hidden={closing} onAnimationEnd={event => { if (closing && event.target === event.currentTarget) { setOpen(false); setClosing(false); } }} style={{ ...(panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: "auto" } : {}), animation: `${closing ? "softphone-minimize" : "softphone-expand"} 240ms cubic-bezier(.2,.8,.2,1) both`, transformOrigin: "top right" }} className={`softphone-motion fixed right-3 top-3 z-[90] flex h-[min(48rem,calc(100dvh-1.5rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[2.6rem] border-[6px] border-[#3037b1] bg-[#f7f8ff] shadow-[0_24px_70px_rgba(34,42,145,0.38)] md:right-4 md:top-20 md:h-[min(48rem,calc(100dvh-6rem))] md:w-[min(24rem,calc(100vw-2rem))] ${closing ? "pointer-events-none" : ""}`}>
      <div onPointerDown={beginPanelDrag} onPointerMove={movePanel} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag} style={{ touchAction: "none" }} className="relative flex cursor-move items-center justify-between gap-3 overflow-hidden bg-gradient-to-br from-[#3037b1] via-[#4654d5] to-[#737cf4] px-5 py-4 text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/10" />
        <div className="flex min-w-0 items-center gap-3"><AdminAvatar name={userName} ariaLabel={`${userName}'s profile avatar. Phone status: ${inCall ? "on a call" : state.state === "ready" ? "available" : state.state === "error" ? "needs attention" : "offline"}`} className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#b3c0ff] to-white text-sm font-bold text-[#1b26bd] shadow-inner ring-1 ring-white/40" fallbackClassName="relative z-10" statusDotClassName={inCall ? "animate-pulse bg-blue-400" : state.state === "ready" ? "bg-emerald-400" : state.state === "error" ? "bg-amber-400" : "bg-slate-300"} /><div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-tight">Conversations</h2><p className="truncate text-[11px] text-indigo-100">{userName}</p></div></div>
        <button type="button" aria-label="Minimise phone" onPointerDown={event => event.stopPropagation()} onClick={minimizePhone} className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6">
      {appTab === "home" ? <div className="space-y-4">
      <div className="flex items-center justify-between px-1"><div><p className="text-xs font-medium text-slate-500">Your calls</p><h3 className="text-lg font-semibold text-slate-900">Overview</h3></div><button type="button" aria-label="Refresh phone overview" onClick={() => void loadWorkspace()} className="rounded-xl border border-indigo-100 bg-white p-2 text-indigo-600"><RefreshCw className="h-4 w-4" /></button></div>
      {workspaceError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{workspaceError}</p>}
      <div className="rounded-[1.35rem] bg-white p-4 shadow-[0_10px_32px_rgba(50,58,157,0.08)]">
        <div className="relative flex items-center justify-center"><button type="button" aria-haspopup="listbox" aria-expanded={dateMenuOpen} onClick={() => setDateMenuOpen(value => !value)} className="flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">{REPORT_RANGES.find(item => item.id === dateRange)?.label || "This month"}<ChevronDown className={`h-4 w-4 text-slate-400 transition ${dateMenuOpen ? "rotate-180" : ""}`} /></button>{dateMenuOpen && <div role="listbox" aria-label="Call stats date range" className="absolute left-1/2 top-11 z-20 w-40 -translate-x-1/2 overflow-hidden rounded-2xl border border-indigo-100 bg-white p-1 shadow-xl">{REPORT_RANGES.map(range => <button key={range.id} type="button" role="option" aria-selected={dateRange === range.id} onClick={() => { setDateRange(range.id); setDateMenuOpen(false); }} className={`block min-h-10 w-full rounded-xl px-3 text-left text-sm ${dateRange === range.id ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>{range.label}</button>)}</div>}</div>
        <div className="relative mx-auto mt-1 h-40 max-w-[18rem]">
          <svg viewBox="0 0 240 145" role="img" aria-label={`${workspace?.callStats.minutes ?? 0} total call minutes`} className="h-full w-full overflow-visible"><defs><linearGradient id="inboundArc" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#3037b1"/><stop offset="1" stopColor="#586ff5"/></linearGradient><linearGradient id="outboundArc" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7489f8"/><stop offset="1" stopColor="#775be8"/></linearGradient></defs><path d="M28 124 A92 92 0 0 1 212 124" fill="none" stroke="#edf0ff" strokeWidth="24" strokeLinecap="round"/><path d={`M28 124 A92 92 0 0 1 ${inboundEnd.x} ${inboundEnd.y}`} fill="none" stroke="url(#inboundArc)" strokeWidth="24" strokeLinecap="round"/><path d={`M${outboundStart.x} ${outboundStart.y} A92 92 0 0 1 212 124`} fill="none" stroke="url(#outboundArc)" strokeWidth="24" strokeLinecap="round"/><text x="120" y="91" textAnchor="middle" fill="#8c90a7" fontSize="11">Total, min</text><text x="120" y="119" textAnchor="middle" fill="#303064" fontSize="27" fontWeight="700">{workspace?.callStats.minutes ?? "—"}</text></svg>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-center">{[["Inbound calls", workspace?.callStats.inboundMinutes ?? "—", "#4e55c9", workspace?.callStats.minutes ? `${Math.round((workspace.callStats.inboundMinutes / workspace.callStats.minutes) * 100)}%` : "0%"], ["Outbound calls", workspace?.callStats.outboundMinutes ?? "—", "#7186f5", workspace?.callStats.minutes ? `${Math.round((workspace.callStats.outboundMinutes / workspace.callStats.minutes) * 100)}%` : "0%"], ["Unanswered calls", workspace?.callStats.unansweredPercent ?? "—", "#b274dc", `${workspace?.callStats.unansweredPercent ?? 0}%`]].map(([label, value, tone, bar]) => <div key={String(label)} className="px-1"><p className="text-base font-semibold text-slate-800">{value}<span className="ml-1 text-[9px] font-normal text-slate-500">{label === "Unanswered calls" ? "%" : "min"}</span></p><div className="mx-auto mt-2 h-1 w-full max-w-20 overflow-hidden rounded-full bg-[#ececff]"><div className="h-full rounded-full" style={{ width: String(bar), backgroundColor: String(tone) }}/></div><p className="mt-2 text-[9px] leading-3 text-slate-500">{label}</p></div>)}</div>
      </div>
      {state.error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p className="break-words">{state.error}</p></div>}
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
          {!context && <div className="space-y-2"><label className="block text-xs font-semibold text-slate-600">Search phone book<input type="search" value={dialSearch} onChange={event => setDialSearch(event.target.value)} placeholder="Find a name or phone number" autoComplete="off" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>{dialSearch.trim() && <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-indigo-100 bg-white p-1" role="listbox" aria-label="Phone book search results">{filteredDialContacts.length ? filteredDialContacts.map(contact => <button key={`${contact.source}-${contact.id}`} type="button" role="option" aria-selected="false" onClick={() => { setName(contact.name); setNumber(contact.phone); setContext({ name: contact.name, phone: contact.phone, target: { phone: contact.phone, name: contact.name } }); setDialSearch(""); setDialError(""); }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-indigo-50"><span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{contact.name}</strong><span className="block truncate text-xs text-slate-500">{contact.group}</span></span><span className="shrink-0 text-xs text-indigo-700">{contact.phone}</span></button>) : <p className="px-3 py-3 text-xs text-slate-500">No phone book contact found.</p>}</div>}</div>}
          <label className="block text-xs font-semibold text-slate-600">Contact name <span className="font-normal text-slate-400">(optional)</span><input value={name} maxLength={120} disabled={!!context || outboundBusy || !!outgoing} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
          <label className="block text-xs font-semibold text-slate-600">Phone number<input type="text" inputMode="text" autoComplete="off" value={number} maxLength={40} readOnly={!!context} disabled={outboundBusy || !!outgoing} onChange={event => { setNumber(event.target.value); setDialError(""); }} placeholder="Phone or sip:agent@provider.example" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
          {context ? <div className="text-xs leading-5 text-slate-500">This contact’s saved number will be loaded securely when calling. <button type="button" className="font-semibold text-indigo-700 underline" onClick={() => { setContext(null); setNumber(""); setName(""); }}>Dial a different number</button></div> : <div aria-label="Dial pad" className="grid grid-cols-3 gap-2">{"123456789+0".split("").map(digit => <button type="button" key={digit} disabled={outboundBusy || !!outgoing} onClick={() => setNumber(value => value.length < 40 ? value + digit : value)} className="min-h-11 rounded-xl border border-slate-100 bg-slate-50 text-base font-semibold text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700">{digit}</button>)}<button type="button" disabled={outboundBusy || !!outgoing} aria-label="Delete last digit" onClick={() => setNumber(value => value.slice(0, -1))} className="min-h-11 rounded-xl border border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-slate-100">Delete</button></div>}
          {dialError && <p role="alert" className="text-sm text-red-700">{dialError}</p>}
          <p className="text-xs leading-5 text-slate-600">Calls use your microphone and may incur charges.</p>
          <button type="submit" disabled={!number.trim() || outboundBusy || !!outgoing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50"><Phone className="h-4 w-4" />Call {context ? name : "number"}</button>
        </form> : <>
        {!queues.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{assignmentLoading ? "Checking your assignment…" : assignmentError || "Your phone access is not enabled yet."}</div>}
        {!queues.length && !assignmentLoading && <button type="button" onClick={() => void loadAssignment()} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50">Check assignment again</button>}
        <button disabled={assignmentLoading || outboundBusy || !!outgoing || state.state === "connecting" || inCall || (!connected && !state.retrying && !queues.length)} onClick={() => { if (connected || state.retrying) { enabled.current = false; void phone.current?.stop(); } else if (!outbound.current) { enabled.current = true; void phone.current?.start(queues); } }} className={`min-h-12 w-full rounded-2xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${connected || state.retrying ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-700 hover:to-blue-700"}`}>{inCall ? "Finish the call to go offline" : connected || state.retrying ? "Go offline" : state.error ? "Retry connection" : "Turn phone on"}</button>
        <p className="text-center text-[11px] leading-5 text-slate-500">Turn your phone on when you’re ready to receive calls. Refreshing the page won’t connect your microphone.</p>
        </>}
      </div>}
      <div className="mt-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{showAllCalls ? "My calls" : "Recent calls"}</h3><button type="button" onClick={() => setShowAllCalls(value => !value)} className="text-xs font-semibold text-indigo-700">{showAllCalls ? "Recent" : "All calls"}</button></div>{workspace?.calls.slice(0, showAllCalls ? 100 : 4).map(call => { const dialNumber = call.customer_phone ? normalizeDialNumber(call.customer_phone) : null; const contactName = call.customer_name || "Call back"; const linkedContact = workspace?.phonebook.contacts.find(contact => contact.id === call.lead_id || contact.linkedLeadId === call.lead_id || (Boolean(dialNumber) && normalizeDialNumber(contact.phone) === dialNumber)); return <div key={call.id} className="flex items-center gap-3 border-t border-slate-100 py-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${call.direction === "inbound" ? "bg-blue-50 text-blue-700" : "bg-indigo-50 text-indigo-700"}`}><Phone className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{call.customer_name || call.customer_phone || "Unknown caller"}</p><p className="text-[11px] text-slate-500">{call.direction === "inbound" ? "Incoming" : "Outgoing"} · {call.status}</p></div><span className="text-[10px] text-slate-400">{new Date(call.created_at).toLocaleDateString()}</span><div className="flex shrink-0 gap-1"><button type="button" aria-label={`Call ${contactName}`} title="Call back" disabled={!dialNumber || inCall || outboundBusy || !!outgoing} onClick={() => { if (!dialNumber) return; setOutgoing({ id: `recent-${call.id}`, name: contactName, phone: dialNumber, target: { phone: dialNumber, name: contactName } }); minimizePhone(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Phone className="h-4 w-4" /></button>{linkedContact && <><button type="button" aria-label={`Messages with ${contactName}`} title="Messages" onClick={() => openContactThread("message", linkedContact)} className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700"><MessageSquare className="h-4 w-4"/></button>{linkedContact.email && <button type="button" aria-label={`Email thread with ${contactName}`} title="Email thread" onClick={() => openContactThread("email", linkedContact)} className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700"><Mail className="h-4 w-4"/></button>}</>}</div></div>})}{!workspace?.calls.length && <p className="py-4 text-center text-xs text-slate-500">Your recent calls will appear here.</p>}</div>
      </div> : appTab === "messages" ? contactThread ? <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" onClick={() => { setContactThread(null); setThreadData(null); setThreadLoading(false); }} className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-indigo-700">← Back</button><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{contactThread.contact.name}</p><p className="text-xs text-slate-500">{contactThread.kind === "email" ? contactThread.contact.email : contactThread.contact.phone}</p></div></div><h3 className="text-lg font-semibold text-slate-900">{contactThread.kind === "email" ? "Email thread" : "Message thread"}</h3>{threadLoading ? <p className="rounded-2xl border border-indigo-100 bg-white p-5 text-center text-sm text-slate-500">Loading conversation…</p> : threadError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{threadError}</p> : contactThread.kind === "email" ? threadData?.emails?.length ? threadData.emails.map(email => <article key={email.id} className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold capitalize text-indigo-700">{email.direction || "Email"}</p><time className="text-[10px] text-slate-400">{email.createdAt ? new Date(email.createdAt).toLocaleString() : ""}</time></div><p className="mt-1 text-sm font-semibold text-slate-900">{email.subject || "No subject"}</p><p className="mt-1 text-[11px] text-slate-500">{email.direction === "inbound" ? email.fromEmail : email.toEmail}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{email.bodyText || email.bodyHtml?.replace(/<[^>]*>/g, " ") || "Email content is unavailable."}</p></article>) : <p className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center text-sm text-slate-500">No email thread is available for this contact yet.</p> : threadData?.messages?.length ? threadData.messages.map(message => <article key={message.id} className={`max-w-[90%] rounded-2xl p-3 text-sm leading-5 ${message.direction === "outbound" ? "ml-auto bg-indigo-600 text-white" : "border border-indigo-100 bg-white text-slate-700"}`}><p className="whitespace-pre-wrap break-words">{message.message}</p><time className={`mt-2 block text-right text-[10px] ${message.direction === "outbound" ? "text-indigo-100" : "text-slate-400"}`}>{new Date(message.created_at).toLocaleString()}</time></article>) : <p className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center text-sm text-slate-500">No messages are available for this contact yet.</p>}</div> : <div className="space-y-4"><div><p className="text-xs font-medium text-slate-500">Contact conversations</p><h3 className="text-xl font-semibold text-slate-900">Messages</h3></div><p className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center text-sm leading-6 text-slate-500">Open a contact from Phone book to view their message or email conversation. SMS campaigns are managed in the main app.</p></div> : appTab === "people" ? <div className="space-y-4"><div><p className="text-xs font-medium text-slate-500">Your saved contacts</p><h3 className="text-xl font-semibold text-slate-900">Phone book</h3></div><label className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3"><Search className="h-4 w-4 text-slate-400"/><input aria-label="Search contacts" value={searchContacts} onChange={event => setSearchContacts(event.target.value)} placeholder="Search name, number or group" className="min-h-11 w-full bg-transparent text-sm outline-none"/></label><div className="flex gap-2 overflow-x-auto pb-1"><button type="button" aria-pressed={selectedGroup === "all"} onClick={() => setSelectedGroup("all")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${selectedGroup === "all" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"}`}>All · {workspace?.phonebook.contacts.length || 0}</button>{workspace?.phonebook.groups.map(group => <button key={group.id} type="button" aria-pressed={selectedGroup === group.id} onClick={() => setSelectedGroup(group.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${selectedGroup === group.id ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"}`}>{group.name} · {group.count}</button>)}</div>{filteredContacts.map(contact => <article key={contact.id} className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-sm font-bold text-indigo-700">{contact.name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{contact.name}</p><p className="truncate text-xs text-slate-500">{contact.phone || contact.email} · {contact.group}</p></div><div className="flex shrink-0 items-center gap-1">{contact.phone && <><button type="button" aria-label={`Call ${contact.name}`} onClick={() => { setName(contact.name); setNumber(contact.phone); setContext({ name: contact.name, phone: contact.phone, target: { phone: contact.phone, name: contact.name } }); setTab("dial"); setAppTab("home"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md"><Phone className="h-4 w-4"/></button><button type="button" aria-label={`Messages with ${contact.name}`} title="Messages" onClick={() => openContactThread("message", contact)} className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700"><MessageSquare className="h-4 w-4"/></button></>}{contact.email && <button type="button" aria-label={`Email thread with ${contact.name}`} title="Email thread" onClick={() => openContactThread("email", contact)} className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700"><Mail className="h-4 w-4"/></button>}</div></article>)}{!!workspace?.phonebook.contacts.length && !filteredContacts.length && <p className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center text-sm text-slate-500">No contacts match this search in the selected group.</p>}{!workspace?.phonebook.contacts.length && <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-7 text-center"><ContactRound className="mx-auto h-8 w-8 text-indigo-300"/><p className="mt-2 text-sm font-medium text-slate-700">No phone book contacts available</p><p className="mt-2 text-xs text-slate-500">Business, lead, and saved contact groups appear here when available.</p></div>}</div> : <div className="space-y-4"><div><p className="text-xs font-medium text-slate-500">Personalise your phone</p><h3 className="text-xl font-semibold text-slate-900">Settings</h3></div><div className="rounded-2xl bg-gradient-to-br from-[#3037b1] via-[#4654d5] to-[#737cf4] p-4 text-white shadow-lg"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Phone availability</p><p className="mt-1 text-xs text-white/75">{connected ? "You're online and can receive calls" : "Your phone is offline"}</p></div><button type="button" role="switch" aria-checked={connected} aria-label="Phone availability" disabled={assignmentLoading || inCall || state.state === "connecting" || outboundBusy || !!outgoing || (!connected && !state.retrying && !queues.length)} onClick={() => { if (connected || state.retrying) { enabled.current = false; void phone.current?.stop(); } else if (!outbound.current) { enabled.current = true; void phone.current?.start(queues); } }} className={`relative h-7 w-12 rounded-full transition ${connected ? "bg-emerald-400" : "bg-white/30"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${connected ? "left-6" : "left-1"}`}/></button></div>{!queues.length && <p className="mt-3 text-xs text-white/80">{assignmentLoading ? "Checking your queue assignment…" : assignmentError || "Ask your administrator to assign a voice queue."}</p>}</div>
        {settingsPanel ? <div className="space-y-3">
          <button type="button" onClick={() => setSettingsPanel(null)} className="flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">← Settings</button>
          {settingsPanel === "voice" ? <AssignedVoiceCampaigns /> : <MediaCallWorkspace />}
        </div> : <div className="space-y-2">
          <button type="button" onClick={() => setSettingsPanel("voice")} className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Megaphone className="h-5 w-5"/></span><span className="flex-1"><strong className="block text-sm text-slate-900">My voice campaigns</strong><small className="text-xs text-slate-500">View campaigns assigned to you or your queues</small></span><ArrowRightLeft className="h-4 w-4 text-slate-400"/></button>

          <button type="button" onClick={() => setSettingsPanel("supervisor")} className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Headphones className="h-5 w-5"/></span><span className="flex-1"><strong className="block text-sm text-slate-900">Team calls</strong><small className="text-xs text-slate-500">Supervisor and coaching tools</small></span><ArrowRightLeft className="h-4 w-4 text-slate-400"/></button>
          <button type="button" onClick={() => { setAppTab("home"); setShowAllCalls(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700"><BarChart3 className="h-5 w-5"/></span><span className="flex-1"><strong className="block text-sm text-slate-900">Call reports</strong><small className="text-xs text-slate-500">Your call history and performance</small></span><ArrowRightLeft className="h-4 w-4 text-slate-400"/></button>
        </div>}
      </div>}
      </div>
      <nav aria-label="Softphone navigation" className="grid shrink-0 grid-cols-4 border-t border-indigo-100 bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2">{[{ id: "home", label: "Home", Icon: Home }, { id: "messages", label: "Messages", Icon: MessageSquare }, { id: "people", label: "People", Icon: Users }, { id: "settings", label: "Settings", Icon: Settings }].map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={appTab === id} onClick={() => { setSettingsPanel(null); if (id !== "messages") { setContactThread(null); setThreadData(null); setThreadLoading(false); } setAppTab(id as typeof appTab); }} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition ${appTab === id ? "text-indigo-700" : "text-slate-400"}`}><Icon className={`h-5 w-5 ${appTab === id ? "fill-indigo-100" : ""}`}/>{label}</button>)}</nav>
    </section>}
    {outgoing && <AzeraOutboundCall contact={outgoing} onClosed={() => setOutgoing(null)} />}
  </div>;
}
