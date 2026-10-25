"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { requestCallMicrophone } from "@/lib/azera-webrtc";

type Call = {
  id: string;
  customer_name: string;
  agent_name: string;
  agent_user_id: string | null;
  status: string;
  transfer_to_user_id: string | null;
  transfer_expires_at: string | null;
  held_at?: string | null;
};
type Connection = {
  id: string;
  url: string;
  token: string;
  privateToken?: string;
  invited?: boolean;
  mode: string;
};
type Agent = { user_id: string; name?: string };
async function control(id: string, action: string, extra: object = {}) {
  const response = await fetch(`/api/azera/calls/${id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Call control failed");
  return data;
}

function MediaAudio({
  connection,
  onClose,
}: {
  connection: Connection;
  onClose: () => void;
}) {
  const rooms = useRef<Room[]>([]),
    stream = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Connecting…"),
    [error, setError] = useState(""),
    [muted, setMuted] = useState(false),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let closed = false;
    let localMedia: MediaStream | null = null;
    const localRooms: Room[] = [];
    rooms.current = localRooms;
    const elements: HTMLMediaElement[] = [];
    const cleanup = () => {
      closed = true;
      localMedia?.getTracks().forEach((track) => track.stop());
      if (stream.current === localMedia) stream.current = null;
      localRooms.forEach((room) => {
        room.removeAllListeners();
        void room.disconnect();
      });
      if (rooms.current === localRooms) rooms.current = [];
      elements.forEach((element) => {
        element.pause();
        element.srcObject = null;
        element.remove();
      });
    };
    async function join(token: string, publish: boolean) {
      const room = new Room();
      localRooms.push(room);
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.setAttribute("playsinline", "");
        elements.push(element);
        void element.play().catch(() => {
          if (!closed) setBlocked(true);
        });
      });
      room.on(RoomEvent.Disconnected, () => {
        if (!closed)
          setStatus("Disconnected. The customer call has not been ended.");
      });
      await room.connect(connection.url, token);
      if (!closed && publish && localMedia)
        await room.localParticipant.publishTrack(
          localMedia.getAudioTracks()[0],
          { source: Track.Source.Microphone },
        );
      return room;
    }
    void (async () => {
      try {
        const publish = connection.mode !== "listen";
        if (publish) {
          const media = await requestCallMicrophone();
          if (closed) {
            media.getTracks().forEach((track) => track.stop());
            return;
          }
          localMedia = media;
          stream.current = media;
        }
        await join(connection.token, publish && connection.mode !== "whisper");
        if (closed) return;
        if (connection.privateToken) await join(connection.privateToken, true);
        else if (connection.mode === "join") {
          if (connection.invited) {
            const accepted = await control(connection.id, "accept");
            if (accepted.warning) setError(accepted.warning);
          }
          const coaching = await control(connection.id, "coach_audio");
          if (!closed) await join(coaching.token, false);
        }
        if (!closed)
          setStatus(
            connection.mode === "listen"
              ? "Listening · microphone disabled"
              : connection.mode === "whisper"
                ? "Private coaching · customer cannot hear you"
                : "Connected",
          );
      } catch (error) {
        if (!closed)
          setError(
            error instanceof Error ? error.message : "Audio could not connect",
          );
        cleanup();
      }
    })();
    const heartbeat = setInterval(() => {
      void fetch("/api/admin/session", { method: "POST" })
        .then((response) => {
          if (response.status === 401 || response.status === 403) cleanup();
        })
        .catch(() => {});
    }, 30_000);
    const pagehide = () => cleanup();
    window.addEventListener("pagehide", pagehide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", pagehide);
      cleanup();
    };
  }, [connection]);
  return (
    <section
      aria-label="Call audio"
      className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
    >
      <p role="status" className="font-medium text-slate-900">
        {status}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {connection.mode !== "listen" && (
          <button
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onClick={() => {
              stream.current?.getAudioTracks().forEach((track) => {
                track.enabled = muted;
              });
              setMuted(!muted);
            }}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        )}
        {blocked && (
          <button
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onClick={() =>
              void Promise.all(rooms.current.map((room) => room.startAudio()))
                .then(() => setBlocked(false))
                .catch(() => setBlocked(true))
            }
          >
            Enable call audio
          </button>
        )}
        <button
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          onClick={onClose}
        >
          Leave audio
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Leaving audio does not hang up the customer. Use End call in the dialler
        to end both legs.
      </p>
    </section>
  );
}

export function MediaCallWorkspace() {
  const [calls, setCalls] = useState<Call[]>([]),
    [agents, setAgents] = useState<Agent[]>([]);
  const [self, setSelf] = useState(""),
    [supervisor, setSupervisor] = useState(false),
    [configured, setConfigured] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [transferCall, setTransferCall] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/azera/media", { cache: "no-store" }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load calls");
      setCalls(data.calls);
      setSelf(data.userId);
      setSupervisor(data.supervisor);
      setConfigured(data.configured);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load calls");
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void refresh();
    });
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function join(id: string, mode: string) {
    if (connection) {
      setError("Leave the current audio session before joining another.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await control(id, mode);
      setConnection({ ...data, mode });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not join the call",
      );
    } finally {
      setBusy(false);
    }
  }
  async function transfer(id: string, userId: string) {
    setBusy(true);
    setError("");
    try {
      const data = await control(id, "invite", { userId });
      setTransferCall(null);
      setError(data.message);
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not invite the agent",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 pb-24 sm:pb-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-semibold text-slate-900">
          Live call workspace
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Self-hosted media · Africa’s Talking remains the telephone provider.
          Supervisor coaching uses a separate private audio room.
        </p>
      </div>
      {!configured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The self-hosted media server is not configured. Existing AT browser
          calls remain available in the inbox. Advanced controls apply only to
          calls routed through your approved media server.
        </p>
      )}
      {error && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800"
        >
          {error}
        </p>
      )}
      {connection && (
        <MediaAudio
          connection={connection}
          onClose={() => setConnection(null)}
        />
      )}
      <label className="block text-sm font-medium">
        Search live calls
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Customer or agent name"
        />
      </label>
      <div className="space-y-3">
        {calls
          .filter((call) =>
            `${call.customer_name} ${call.agent_name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((call) => (
            <article
              key={call.id}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <h2 className="break-words font-semibold">
                {call.customer_name || "Customer"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {call.agent_name || "AI assistant"} ·{" "}
                {call.status === "active" ? "Connected" : "Ringing"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(call.agent_user_id === self ||
                  call.transfer_to_user_id === self) && (
                  <button
                    disabled={busy || !configured || !!connection}
                    className="min-h-11 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    onClick={() => void join(call.id, "join")}
                  >
                    {call.transfer_to_user_id === self
                      ? "Join and accept transfer"
                      : "Join assigned call"}
                  </button>
                )}
                {call.agent_user_id === self && call.status === "active" && (
                  <button
                    disabled={busy}
                    className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onClick={() => {
                      setTransferCall(call.id);
                      void fetch("/api/azera/presence")
                        .then((r) => r.json())
                        .then((data) => setAgents(data.online || []))
                        .catch(() => setError("Could not load agents"));
                    }}
                  >
                    Transfer to agent
                  </button>
                )}
                {call.agent_user_id === self && call.transfer_to_user_id && (
                  <button
                    className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onClick={() =>
                      void control(call.id, "cancel")
                        .then(refresh)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Cancel invitation
                  </button>
                )}
                {call.agent_user_id === self && (
                  <button
                    disabled={busy}
                    className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                    onClick={() => {
                      setBusy(true);
                      void control(call.id, "end")
                        .then(() => {
                          if (connection?.id === call.id) setConnection(null);
                          return refresh();
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    End customer call
                  </button>
                )}
                {call.agent_user_id === self &&
                  call.status === "active" &&
                  !call.transfer_to_user_id && (
                    <button
                      disabled={busy}
                      className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => {
                        setBusy(true);
                        void control(call.id, call.held_at ? "resume" : "hold")
                          .then(refresh)
                          .catch((e) => setError(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {call.held_at ? "Resume caller" : "Hold caller"}
                    </button>
                  )}
                {call.transfer_to_user_id === self && (
                  <button
                    className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onClick={() =>
                      void control(call.id, "decline")
                        .then(refresh)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Decline transfer
                  </button>
                )}
                {supervisor &&
                  call.agent_user_id !== self &&
                  ["listen", "whisper", "barge"].map((mode) => (
                    <button
                      key={mode}
                      disabled={
                        busy ||
                        !configured ||
                        !!connection ||
                        call.status !== "active"
                      }
                      className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => {
                        if (
                          mode !== "barge" ||
                          window.confirm(
                            "Join this customer call with your microphone?",
                          )
                        )
                          void join(call.id, mode);
                      }}
                    >
                      {mode === "listen"
                        ? "Listen only"
                        : mode === "whisper"
                          ? "Coach privately"
                          : "Join customer call"}
                    </button>
                  ))}
              </div>
              {transferCall === call.id && (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">
                    Stay connected until the receiving agent accepts. This is a
                    direct agent handover, not a private consultation transfer.
                  </p>
                  {agents
                    .filter((agent) => agent.user_id !== self)
                    .map((agent) => (
                      <button
                        disabled={busy}
                        className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-sm"
                        key={agent.user_id}
                        onClick={() => void transfer(call.id, agent.user_id)}
                      >
                        {agent.name || "Team member"}
                      </button>
                    ))}
                </div>
              )}
            </article>
          ))}
        {!calls.length && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No active self-hosted calls.
          </p>
        )}
      </div>
    </div>
  );
}
