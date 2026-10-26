"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Play, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Voicemail = {
  id: string; caller_phone: string | null; department_key: string | null; status: "new" | "listened" | "resolved"; notes: string | null; follow_up_at: string | null; created_at: string; duration_seconds: number | null; signed_url: string | null; assigned_user_id: string | null; assigned_user?: { name?: string; username?: string } | null; azera_calls?: { selected_department?: string | null; created_at?: string } | null;
};
type Agent = { id: string; name: string; username: string; role: string };
const statusOptions = ["new", "listened", "resolved"] as const;
const dateTime = (value: string) => new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });

export default function AzeraVoicemailsPage() {
  const [items, setItems] = useState<Voicemail[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/azera/voicemails?include_agents=1${status ? `&status=${status}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load voicemail inbox.");
      setItems(data.data || []); setAgents(data.agents || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load voicemail inbox."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = async (item: Voicemail, updates: Record<string, unknown>) => {
    setSaving(item.id); setError("");
    try {
      const response = await fetch("/api/azera/voicemails", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, ...updates }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save voicemail.");
      setItems(current => current.map(row => row.id === item.id ? { ...row, ...updates } as Voicemail : row));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save voicemail."); }
    finally { setSaving(null); }
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">Voicemail inbox</h1><p className="mt-1 text-sm text-slate-600">Messages are downloaded into MartPoint’s private storage and automatically removed after the configured retention period.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    <div className="flex flex-wrap gap-2">{statusOptions.map(option => <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-full border px-4 py-2 text-sm capitalize ${status === option ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>{option}</button>)}<button type="button" onClick={() => setStatus("")} className={`rounded-full border px-4 py-2 text-sm ${status === "" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700"}`}>All</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Card><CardHeader><CardTitle>{loading ? "Loading…" : `${items.length} message${items.length === 1 ? "" : "s"}`}</CardTitle></CardHeader><CardContent className="space-y-4">
      {!loading && !items.length && <p className="py-10 text-center text-sm text-slate-600">No voicemails in this view.</p>}
      {items.map(item => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{item.caller_phone || "Unknown caller"}</p><p className="text-xs text-slate-500">{dateTime(item.created_at)} · {item.department_key || item.azera_calls?.selected_department || "General enquiries"}{item.duration_seconds ? ` · ${item.duration_seconds}s` : ""}</p></div>{item.signed_url ? <a className="inline-flex min-h-10 items-center rounded-lg bg-retail px-3 text-sm font-medium text-white" href={item.signed_url} target="_blank" rel="noreferrer"><Play className="mr-2 h-4 w-4" />Play</a> : <span className="text-xs text-slate-500">Audio expired</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs font-medium text-slate-600">Status<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={item.status} disabled={saving === item.id} onChange={event => void update(item, { status: event.target.value })}>{statusOptions.map(option => <option key={option}>{option}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Assign follow-up<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm" value={item.assigned_user_id || ""} disabled={saving === item.id} onChange={event => void update(item, { assigned_user_id: event.target.value || null })}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name || agent.username} · {agent.role}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Follow-up date<input type="datetime-local" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm" defaultValue={item.follow_up_at ? new Date(item.follow_up_at).toISOString().slice(0, 16) : ""} disabled={saving === item.id} onBlur={event => void update(item, { follow_up_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label></div><label className="mt-3 block text-xs font-medium text-slate-600">Notes<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 p-2 text-sm" defaultValue={item.notes || ""} disabled={saving === item.id} onBlur={event => void update(item, { notes: event.target.value })} /></label>{saving === item.id && <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Saving…</p>}{item.status === "resolved" && <p className="mt-2 flex items-center gap-1 text-xs text-green-700"><Check className="h-3 w-3" />Resolved</p>}</article>)}
    </CardContent></Card>
  </div>;
}
