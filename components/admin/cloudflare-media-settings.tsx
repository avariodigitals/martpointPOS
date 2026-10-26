"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { CLOUDFLARE_SETUP_CHECKS, fetchCloudflareSetupStatus, type CloudflareSetupStatus } from "@/lib/cloudflare-setup-status";
export function CloudflareMediaSettings() {
  const [status, setStatus] = useState<CloudflareSetupStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
    setLoading(true); setError("");
    try {
      const value = await fetchCloudflareSetupStatus(controller.signal);
      if (!controller.signal.aborted) setStatus(value);
    } catch (error) {
      if (timedOut) setError("The setup check timed out. Check your connection and retry.");
      else if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Cloudflare setup could not be checked. Please try again.");
    } finally {
      window.clearTimeout(timer);
      if (pending.current === controller && (!controller.signal.aborted || timedOut)) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(initial); pending.current?.abort(); };
  }, [load]);
  return <Card className="min-w-0">
    <CardHeader><CardTitle className="text-sm font-medium">Cloudflare website calls</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm leading-6">
      <p>This is a setup checklist, not an AI setting or a place to paste keys. Configure the values in Vercel and use Refresh to check what this deployed application can see.</p>
      <p>No VPS is needed. Cloudflare carries website-visitor-to-staff audio. It does not control the 020 line, telephone greetings or Africa’s Talking routing.</p>
      <div role="status" aria-live="polite" className="rounded-lg bg-blue-50 p-3 text-blue-900">
        {loading ? "Checking deployed website-call configuration…" : error ? "Setup check failed. Previous results, if shown, may be out of date." : status?.enabled ? "Configuration ready for a live audio test. This is not confirmation that a call has succeeded." : "Website calling still needs setup. Follow the items marked Needs setup below."}
        {status && <p className="mt-1 text-xs">Last successful check: {new Date(status.checkedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} WAT.</p>}
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {status && <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {CLOUDFLARE_SETUP_CHECKS.map(check => <div key={check.key} className="min-w-0"><dt className="font-medium text-slate-800">{check.label}</dt><dd className={status[check.key] ? "text-emerald-700" : "text-amber-800"}>{status[check.key] ? "Configured" : "Needs setup"}</dd>{!status[check.key] && <dd className="mt-1 break-words text-xs leading-5 text-slate-700">{check.action}</dd>}</div>)}
      </dl>}
      <p className="break-words text-slate-600">Put credentials in Vercel → Project → Settings → Environment Variables. Never use a <code>NEXT_PUBLIC_</code> prefix for secrets. No DNS change or domain attachment is needed for the SFU application.</p>
      <ul className="list-disc space-y-1 pl-5 text-slate-700">
        <li><code className="break-all">CLOUDFLARE_REALTIME_APP_ID</code> and <code className="break-all">CLOUDFLARE_REALTIME_APP_SECRET</code></li>
        <li><code className="break-all">CLOUDFLARE_TURN_KEY_ID</code> and <code className="break-all">CLOUDFLARE_TURN_API_TOKEN</code> from the separate TURN service</li>
        <li><code className="break-all">AZERA_BROWSER_MEDIA=cloudflare</code> and the existing <code>CRON_SECRET</code></li>
      </ul>
      <p className="text-slate-600">After changing environment variables, redeploy first. Refresh does not save settings, activate Cloudflare, rotate keys or redeploy Vercel. Verify the five-minute cleanup job and test two-way audio on separate devices before public use.</p>
      <p className="text-slate-600">Uses Realtime SFU/TURN, not paid RealtimeKit. Supervisor controls, telephone bridging and automatic recording are not included in this Cloudflare path.</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={loading} aria-busy={loading} onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 font-medium text-slate-800 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{loading ? "Checking setup…" : "Refresh setup status"}</button><a href="https://developers.cloudflare.com/realtime/sfu/platform/pricing/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-blue-700 underline">Cloudflare media pricing</a></div>
    </CardContent>
  </Card>;
}
