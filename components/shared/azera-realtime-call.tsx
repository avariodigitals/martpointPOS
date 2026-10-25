"use client";
import { useEffect, useRef, useState } from "react";
import { AzeraRealtimeCall } from "@/lib/azera-realtime-call";
import type { CallSnapshot } from "@/lib/azera-webrtc";
import { AzeraCallUI } from "@/components/shared/azera-webrtc-call";

export function AzeraRealtimeCallController({
  stream,
  token,
  onEnded,
  onHandoff,
}: {
  stream: MediaStream;
  token: string;
  onEnded: () => void;
  onHandoff: () => void;
}) {
  const engine = useRef<AzeraRealtimeCall | null>(null);
  const handoff = useRef(onHandoff);
  useEffect(() => {
    handoff.current = onHandoff;
  }, [onHandoff]);
  const [snapshot, setSnapshot] = useState<CallSnapshot>({
    state: "connecting",
    error: null,
    isMuted: false,
    audioBlocked: false,
  });
  useEffect(() => {
    const call = new AzeraRealtimeCall(stream, token, setSnapshot, () =>
      handoff.current(),
    );
    engine.current = call;
    queueMicrotask(() => {
      if (!call.disposed) void call.start();
    });
    const close = () => call.dispose();
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      call.dispose();
    };
  }, [stream, token]);
  async function end() {
    if (await engine.current?.end()) onEnded();
  }
  return (
    <AzeraCallUI
      {...snapshot}
      customerName="Azera · AI voice assistant"
      outgoing
      onEnd={() => void end()}
      onReject={() => void end()}
      onToggleMute={() => engine.current?.toggleMute()}
      onResumeAudio={() => void engine.current?.resumeAudio()}
    />
  );
}
