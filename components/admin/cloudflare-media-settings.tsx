"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
type Status = { selected: boolean; appConfigured: boolean; turnConfigured: boolean; cleanupConfigured: boolean; schemaReady: boolean; enabled: boolean };
async function fetchStatus(signal: AbortSignal): Promise<Status> {
  const response = await fetch("/api/azera/cloudflare", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not check Cloudflare setup");
  return response.json();
}
export function CloudflareMediaSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setStatus(await fetchStatus(AbortSignal.timeout(10_000))); setError("");
    } catch { setError("Cloudflare setup could not be checked. Please try again."); }
  };
  useEffect(() => {
    let active = true;
    void fetchStatus(AbortSignal.timeout(10_000)).then((value) => { if (active) setStatus(value); }).catch(() => { if (active) setError("Cloudflare setup could not be checked. Please try again."); });
    return () => { active = false; };
  }, []);
  return <Card className="min-w-0">
    <CardHeader><CardTitle className="text-sm font-medium">Cloudflare website calls</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm leading-6">
      <p>No VPS is needed. The website stays on its existing domain; Cloudflare carries browser-to-agent audio. This does not change Africa’s Talking telephone routing.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {status && <dl className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {[["SFU App ID and secret", status.appConfigured], ["TURN key and token", status.turnConfigured], ["Migration 136", status.schemaReady], ["Cleanup secret", status.cleanupConfigured], ["Selected for website calls", status.selected]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-slate-600">{label}</dt><dd className={value ? "font-medium text-emerald-700" : "font-medium text-amber-800"}>{value ? "Configured" : "Needs setup"}</dd></div>)}
      </dl>}
      <p className="break-words text-slate-600">Put credentials in Vercel → Project → Settings → Environment Variables. Never use a <code>NEXT_PUBLIC_</code> prefix for secrets. No DNS change or domain attachment is needed for the SFU application.</p>
      <ul className="list-disc space-y-1 pl-5 text-slate-700">
        <li><code className="break-all">CLOUDFLARE_REALTIME_APP_ID</code> and <code className="break-all">CLOUDFLARE_REALTIME_APP_SECRET</code></li>
        <li><code className="break-all">CLOUDFLARE_TURN_KEY_ID</code> and <code className="break-all">CLOUDFLARE_TURN_API_TOKEN</code> from the separate TURN service</li>
        <li><code className="break-all">AZERA_BROWSER_MEDIA=cloudflare</code> and the existing <code>CRON_SECRET</code></li>
      </ul>
      <p className="text-slate-600">Apply migration 136 after 135, verify the five-minute cleanup cron, then redeploy. Configuration is not live verification: test two-way audio, mute, hang up and mobile networks before enabling publicly.</p>
      <p className="text-slate-600">Uses Realtime SFU/TURN, not paid RealtimeKit. Supervisor controls, telephone bridging and automatic recording are not included in this Cloudflare path.</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void load()} className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-800">Refresh setup status</button><a href="https://developers.cloudflare.com/realtime/sfu/platform/pricing/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-blue-700 underline">Cloudflare media pricing</a></div>
    </CardContent>
  </Card>;
}
