"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  Pause,
  Play,
} from "lucide-react";
import type { PhoneCallSnapshot } from "@/lib/azera-phone-call";
import { AfricaBrowserCall } from "@/lib/africa-browser-call";
import type { BrowserPhoneTarget } from "@/lib/browser-phone-target";

export interface OutboundContact {
  id: string;
  name: string;
  phone: string;
  target?: BrowserPhoneTarget;
}
export function AzeraOutboundCall({
  contact,
  onClosed,
}: {
  contact: OutboundContact;
  onClosed: () => void;
}) {
  const engine = useRef<{
    disposed: boolean;
    start: () => Promise<void>;
    dispose: () => void;
    end: () => Promise<boolean>;
    toggleMute: () => Promise<void>;
    resumeAudio: () => Promise<void>;
    toggleHold?: () => void;
    dtmf?: (digit: string) => void;
    startRecording?: () => Promise<void>;
    stopRecording?: () => Promise<void>;
    declineRecording?: () => Promise<void>;
  } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [call, setCall] = useState<PhoneCallSnapshot>({
    state: "connecting",
    error: null,
    muted: false,
    audioBlocked: false,
    setupRequired: false,
  });
  const [ending, setEnding] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState("");
  useEffect(() => {
    let closed = false;
    const abort = new AbortController();
    void (async () => {
      // React's development Strict Mode mounts/cleans a probe effect. Let that
      // cleanup finish before acquiring the phone lock or asking for a mic.
      await Promise.resolve();
      if (closed) return;
      const sipAddress = contact.target && "sipAddress" in contact.target ? contact.target.sipAddress : null;
      let selfHosted = Boolean(sipAddress);
      if (!contact.target) {
        try {
          const response = await fetch("/api/azera/calls/outbound", {
            cache: "no-store",
            signal: abort.signal,
          });
          selfHosted = response.ok && (await response.json()).ready === true;
        } catch {
          /* Keep the existing Africa's Talking browser dialler. */
        }
      }
      if (closed) return;
      const current = selfHosted
        ? new (await import("@/lib/azera-phone-call")).BrowserPhoneCall(sipAddress ? { sipAddress, name: contact.name } : contact.id, setCall)
        : new AfricaBrowserCall(contact.target || contact.id, setCall);
      if (closed) { current.dispose(); return; }
      engine.current = current;
      setAdvanced(selfHosted);
      if (!current.disposed) await current.start();
    })();
    const close = () => engine.current?.dispose();
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      closed = true;
      abort.abort();
      engine.current?.dispose();
      engine.current = null;
    };
  }, [contact.id, contact.name, contact.target]);
  async function end() {
    setEnding(true);
    if (await engine.current?.end()) onClosed();
    setEnding(false);
  }
  // Escape the topbar's backdrop-filter containing block: fixed call controls
  // must stay inside the viewport, not above the header's bottom edge.
  return typeof document === "undefined" ? null : createPortal(
    <section
      aria-label="Outbound phone call"
      className="fixed bottom-5 right-5 z-[100] max-h-[calc(100dvh-3rem)] w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {contact.name}
          </h2>
          <p className="text-xs text-slate-500">{contact.phone}</p>
        </div>
      </div>
      <p role="status" className="mt-3 text-sm font-medium text-slate-700">
        {call.state === "connecting"
          ? "Connecting your browser…"
          : call.state === "ringing"
            ? "Calling contact…"
            : call.state === "active"
              ? "Call connected"
              : call.state === "ended"
                ? call.transferred
                  ? "Call handed over"
                  : "Call ended"
                : "Call unavailable"}
      </p>
      {call.error && (
        <p role="alert" className="mt-2 text-sm leading-6 text-red-700">
          {call.error}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Browser call
      </p>
      {advanced && (
        <Link
          className="mt-2 block text-sm font-medium text-blue-700 underline"
          href="/admin/azera/calls"
        >
          Open transfer and supervisor workspace
        </Link>
      )}
      {call.setupRequired && (
        <p className="mt-3 text-sm text-slate-600">
          Ask an administrator to check phone setup.
        </p>
      )}
      {call.state === "active" && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <p>To record and summarize this call, tell the contact first and get their agreement. Recording starts only after you confirm agreement below.</p>
            {call.recording ? <button type="button" disabled={recordingBusy} onClick={() => { setRecordingBusy(true); setRecordingMessage(""); void engine.current?.stopRecording?.().then(() => setRecordingMessage("Recording saved. Azera is preparing the transcript and summary." )).catch(error => setRecordingMessage(error instanceof Error ? error.message : "Recording could not be saved.")).finally(() => setRecordingBusy(false)); }} className="mt-2 min-h-10 w-full rounded-lg bg-amber-700 px-3 font-semibold text-white disabled:opacity-50">{recordingBusy ? "Saving recording…" : "Stop recording"}</button> : <><button type="button" disabled={recordingBusy} onClick={() => { setRecordingBusy(true); setRecordingMessage(""); void engine.current?.startRecording?.().then(() => setRecordingMessage("Recording is on. The contact's agreement was recorded in the call audit." )).catch(error => setRecordingMessage(error instanceof Error ? error.message : "Recording could not start.")).finally(() => setRecordingBusy(false)); }} className="mt-2 min-h-10 w-full rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900 disabled:opacity-50">{recordingBusy ? "Preparing recording…" : "Recipient agreed — start recording"}</button><button type="button" disabled={recordingBusy} onClick={() => { setRecordingBusy(true); setRecordingMessage(""); void engine.current?.declineRecording?.().then(() => setRecordingMessage("Recipient declined. The call continued without recording." )).catch(error => setRecordingMessage(error instanceof Error ? error.message : "Could not save the recording choice.")).finally(() => setRecordingBusy(false)); }} className="min-h-9 w-full rounded-lg px-3 text-xs text-slate-700 underline disabled:opacity-50">Recipient declined — continue without recording</button></>}
            {(recordingMessage || call.recordingError) && <p role="status" className="mt-2">{call.recordingError || recordingMessage}</p>}
          </div>
          <button
            onClick={() => void engine.current?.toggleHold?.()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 text-sm"
          >
            {call.held ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {call.held ? "Resume call" : "Hold call"}
          </button>
          <div aria-label="Phone keypad" className="grid grid-cols-3 gap-1">
            {"123456789*0#".split("").map((digit) => (
              <button
                key={digit}
                aria-label={`Dial ${digit}`}
                className="min-h-9 rounded-lg bg-slate-50 text-sm hover:bg-blue-50"
                onClick={() => engine.current?.dtmf?.(digit)}
              >
                {digit}
              </button>
            ))}
          </div>
        </div>
      )}
      {call.state === "ended" && call.recordingError && <p role="alert" className="mt-2 text-xs text-red-700">{call.recordingError}</p>}
      {call.audioBlocked && (
        <button
          onClick={() => void engine.current?.resumeAudio()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-700"
        >
          <Volume2 className="h-4 w-4" />
          Tap to hear the call
        </button>
      )}
      <div className="mt-4 flex gap-2">
        {["active", "ringing"].includes(call.state) && (
          <button
            onClick={() => void engine.current?.toggleMute()}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium"
          >
            {call.muted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {call.muted ? "Unmute" : "Mute"}
          </button>
        )}
        <button
          disabled={ending}
          onClick={() => void end()}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          <PhoneOff className="h-4 w-4" />
          {ending
            ? "Ending…"
            : call.setupRequired || call.state === "ended" || call.state === "error"
              ? "Close"
              : "End call"}
        </button>
      </div>
    </section>,
    document.body
  );
}
