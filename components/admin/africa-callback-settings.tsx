"use client";
import { useState } from "react";
export function AfricaCallbackSettings() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy(kind: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/azera/calls/africa-browser/provider-urls", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load callback URLs.");
      await navigator.clipboard.writeText(result.urls[kind]);
      setStatus(`${kind === "events" ? "Events" : kind === "callback" ? "Callback" : "Recording"} URL copied. Paste it into Africa’s Talking Voice → Phone Numbers.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not copy the URL."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm">
    <h3 className="font-semibold text-slate-900">Africa’s Talking production callbacks</h3>
    <p className="mt-2 leading-6 text-slate-700">Replace the provider’s test callback with your MartPoint callback. Configure Events separately where supported. The same callback handles browser-originated calls and incoming telephone calls.</p>
    <div className="mt-3 flex flex-wrap gap-2">{["callback", "events", "recording"].map(kind => <button type="button" key={kind} disabled={busy} onClick={() => void copy(kind)} className="min-h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 disabled:opacity-50">Copy {kind} URL</button>)}</div>
    <p className="mt-2 text-xs leading-5 text-slate-600">Copied URLs include your callback secret. Paste only into the provider dashboard; do not share them publicly. This does not change provider settings automatically.</p>
    <p className="mt-2 text-xs leading-5 text-slate-600">Staff: use the phone button in the admin header to enable incoming calls and choose Sales, Support, Onboarding or General enquiries. Keep the browser tab open. Existing phone/SIP destinations remain fallbacks.</p>
    {status && <p role="status" className="mt-2 break-words text-sm text-slate-800">{status}</p>}
  </div>;
}
