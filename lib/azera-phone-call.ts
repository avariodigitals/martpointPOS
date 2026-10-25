import { Room, RoomEvent, Track } from "livekit-client";
import { requestCallMicrophone } from "@/lib/azera-webrtc";

export type PhoneCallSnapshot = {
  state: "connecting" | "ringing" | "active" | "ended" | "error";
  error: string | null;
  muted: boolean;
  audioBlocked: boolean;
  setupRequired: boolean;
  held?: boolean;
  id?: string;
  transferred?: boolean;
};

/** A staff browser joins and publishes audio BEFORE the telephone is dialled. */
export class BrowserPhoneCall {
  snapshot: PhoneCallSnapshot = {
    state: "connecting",
    error: null,
    muted: false,
    audioBlocked: false,
    setupRequired: false,
  };
  disposed = false;
  private finished = false;
  private started = false;
  private id: string | null = null;
  private room: Room | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLMediaElement[] = [];
  private coaching: Room | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private failures = 0;
  constructor(
    private conversationId: string,
    private onChange: (snapshot: PhoneCallSnapshot) => void,
  ) {}
  private change(next: Partial<PhoneCallSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    this.onChange(this.snapshot);
  }
  private async request(
    path: string,
    method = "GET",
    body?: object,
    keepalive = false,
  ) {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        cache: "no-store",
        keepalive,
        signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        "The voice connection was interrupted. Check your connection and try again.",
      );
    }
    const data = await response.json();
    if (!response.ok) {
      if (data.status === "transferred") {
        this.finished = true;
        this.release();
        this.change({ state: "ended", error: null, transferred: true });
        return { status: "transferred" };
      }
      throw new Error(
        data.error || "The call could not connect. Please try again.",
      );
    }
    return data;
  }
  private get endpoint() {
    return `/api/azera/calls/${encodeURIComponent(this.id!)}/outbound`;
  }
  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    try {
      const config = await this.request("/api/azera/calls/outbound");
      if (this.finished) return;
      if (!config.ready) {
        this.finished = true;
        this.change({
          state: "error",
          setupRequired: true,
          error:
            "Browser calling is not configured yet. Complete LiveKit and SIP settings in Admin → Integrations. No device dialer will be opened.",
        });
        return;
      }
      const stream = await requestCallMicrophone();
      if (this.finished) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const prepared = await this.request("/api/azera/calls/outbound", "POST", {
        conversationId: this.conversationId,
      });
      this.id = prepared.id;
      this.change({ id: this.id! });
      if (this.finished) {
        await this.request(this.endpoint, "DELETE", undefined, true);
        return;
      }
      const room = new Room();
      this.room = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.setAttribute("playsinline", "");
        this.audio.push(element);
        void element.play().catch(() => this.change({ audioBlocked: true }));
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () =>
        this.change({ audioBlocked: !room.canPlaybackAudio }),
      );
      room.on(RoomEvent.Disconnected, () => {
        if (!this.finished) void this.end();
      });
      await room.connect(prepared.url, prepared.token);
      if (this.finished) return;
      await room.localParticipant.publishTrack(stream.getAudioTracks()[0], {
        source: Track.Source.Microphone,
      });
      if (this.finished) return;
      this.change({ state: "ringing" });
      this.deadline = setTimeout(
        () =>
          void this.fail(
            "The customer didn’t answer. You can try again later.",
            "missed",
          ),
        75_000,
      );
      await this.request(this.endpoint, "POST", {});
      if (!this.finished) void this.poll();
      // Listen to a separate coaching room; the customer's room never receives
      // supervisor whisper audio. Failure leaves the customer call intact.
      void this.request(`/api/azera/calls/${this.id}/media`, "POST", {
        action: "coach_audio",
      })
        .then(async (config) => {
          if (this.finished) return;
          const coaching = new Room();
          this.coaching = coaching;
          coaching.on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind !== Track.Kind.Audio) return;
            const element = track.attach();
            element.setAttribute("playsinline", "");
            this.audio.push(element);
            void element
              .play()
              .catch(() => this.change({ audioBlocked: true }));
          });
          await coaching.connect(config.url, config.token);
          if (this.finished) await coaching.disconnect();
        })
        .catch(() => {});
    } catch (error) {
      if (!this.finished)
        await this.fail(
          error instanceof Error
            ? error.message
            : "The call could not connect.",
        );
    }
  }
  private async poll() {
    if (this.finished) return;
    try {
      const { status } = await this.request(this.endpoint);
      if (this.finished) return;
      if (status === "active") {
        clearTimeout(this.deadline);
        this.change({ state: "active" });
      } else if (["ended", "missed", "failed", "busy"].includes(status)) {
        this.finished = true;
        this.release();
        this.change({
          state: status === "ended" ? "ended" : "error",
          error:
            status === "ended"
              ? null
              : "The customer could not be reached. Please try again later.",
        });
        return;
      }
      this.failures = 0;
    } catch (error) {
      if (++this.failures >= 3) {
        await this.fail(
          error instanceof Error ? error.message : "The call disconnected.",
        );
        return;
      }
    }
    if (!this.finished) this.timer = setTimeout(() => void this.poll(), 2000);
  }
  async toggleMute() {
    const muted = !this.snapshot.muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.change({ muted });
  }
  async resumeAudio() {
    try {
      await this.room?.startAudio();
      this.change({ audioBlocked: false });
    } catch {
      this.change({ audioBlocked: true });
    }
  }
  async toggleHold() {
    if (this.snapshot.state !== "active" || !this.id) return;
    try {
      const result = await this.request(
        `/api/azera/calls/${this.id}/media`,
        "POST",
        { action: this.snapshot.held ? "resume" : "hold" },
      );
      this.change({ held: result.held, error: null });
    } catch (error) {
      this.change({
        error:
          error instanceof Error
            ? error.message
            : "Hold could not be confirmed",
      });
    }
  }
  dtmf(digit: string) {
    if (!/^[0-9*#]$/.test(digit) || this.snapshot.state !== "active") return;
    const code = digit === "*" ? 10 : digit === "#" ? 11 : Number(digit);
    void this.room?.localParticipant
      .publishDtmf(code, digit)
      .catch(() => this.change({ error: "The keypad tone could not be sent" }));
  }
  async end() {
    this.finished = true;
    this.release();
    try {
      if (this.id)
        await this.request(
          `/api/azera/calls/${this.id}/media`,
          "POST",
          { action: "end" },
          true,
        );
      this.change({ state: "ended", error: null });
      return true;
    } catch {
      this.change({
        state: "error",
        error:
          "Your microphone is off, but the telephone call could not be closed. Click End call again.",
      });
      return false;
    }
  }
  private async fail(message: string, reason = "failed") {
    this.finished = true;
    this.release();
    try {
      if (this.id)
        await this.request(
          `${this.endpoint}?reason=${reason}`,
          "DELETE",
          undefined,
          true,
        );
    } catch {
      message += " Click End call to retry closing the telephone connection.";
    }
    this.change({ state: "error", error: message });
  }
  private release() {
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audio.forEach((element) => {
      element.pause();
      element.srcObject = null;
      element.remove();
    });
    this.audio = [];
    if (this.room) {
      this.room.removeAllListeners();
      void this.room.disconnect();
      this.room = null;
    }
    if (this.coaching) {
      this.coaching.removeAllListeners();
      void this.coaching.disconnect();
      this.coaching = null;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.finished) void this.end();
    else this.release();
  }
}
