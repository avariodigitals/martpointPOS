"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PhoneCall } from "lucide-react";

const queues = [
  ["sales", "Sales"],
  ["support", "Support"],
  ["onboarding", "Onboarding"],
  ["customer_support", "General enquiries"],
] as const;
type Agent = { id: string; name: string; username: string; email: string | null; role: string; queues: string[]; enabled: boolean; browserPhoneReady: boolean };

export default function AzeraVoiceAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/azera/voice-agents", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load voice assignments.");
      setAgents(data.agents || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load voice assignments."); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const refresh = window.setInterval(() => { void load(true); }, 15_000);
    return () => { window.clearTimeout(timer); window.clearInterval(refresh); };
  }, []);
  const update = async (agent: Agent, queue: string) => {
    const next = agent.queues.includes(queue) ? agent.queues.filter(item => item !== queue) : [...agent.queues, queue];
    setAgents(current => current.map(item => item.id === agent.id ? { ...item, queues: next, enabled: next.length > 0 } : item));
    setSaving(agent.id); setMessage("");
    try {
      const response = await fetch("/api/azera/voice-agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: agent.id, queues: next, enabled: next.length > 0 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save assignment.");
      setMessage(`${agent.name} voice assignment saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save assignment."); void load(); }
    finally { setSaving(null); }
  };
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900">Voice agent assignments</h1><p className="mt-1 text-sm text-slate-600">Only assigned team members can register a browser phone. A person can belong to more than one queue.</p></div>
    {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" /> Who can answer calls?</CardTitle></CardHeader><CardContent>
      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading assignments…</div> : !agents.length ? <p className="py-8 text-sm text-slate-600">No active Sales, Customer Care, Tech, or Admin users are available.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Team member</th><th className="px-3 py-3">Browser phone</th>{queues.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{agents.map(agent => <tr key={agent.id} className="border-b last:border-0"><td className="px-3 py-4"><p className="font-medium text-slate-900">{agent.name || agent.username}</p><p className="text-xs text-slate-500">{agent.role} · {agent.email || agent.username}</p></td><td className="px-3 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${agent.browserPhoneReady ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}><span className={`h-2 w-2 rounded-full ${agent.browserPhoneReady ? "bg-green-500" : "bg-slate-400"}`} />{agent.browserPhoneReady ? "Online" : "Offline"}</span></td>{queues.map(([key, label]) => <td key={key} className="px-3 py-4"><label className="inline-flex items-center gap-2"><input type="checkbox" aria-label={`${agent.name || agent.username}: ${label}`} checked={agent.enabled && agent.queues.includes(key)} disabled={saving === agent.id} onChange={() => void update(agent, key)} /><span className="sr-only">{label}</span></label></td>)}</tr>)}</tbody></table></div>}
    </CardContent></Card>
    <p className="text-xs leading-5 text-slate-500">Online means the agent has enabled Receive calls in the header phone and the browser checked in within the last minute. Each inbound call rings all available agents in its selected queue at once, alongside configured phone/SIP fallbacks; the first to answer takes the call. If nobody in that queue is online, only the configured fallbacks ring. Keep assigned agents signed in with Receive calls enabled during business hours.</p>
  </div>;
}
