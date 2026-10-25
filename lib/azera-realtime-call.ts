import type { CallSnapshot } from "@/lib/azera-webrtc";

/** Direct browser audio: no LiveKit, public API key or local phone dialler. */
export class AzeraRealtimeCall {
  disposed = false;
  snapshot: CallSnapshot = {
    state: "connecting",
    error: null,
    isMuted: false,
    audioBlocked: false,
  };
  private started = false;
  private finished = false;
  private id: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private audio: HTMLAudioElement | null = null;
  private dc: RTCDataChannel | null = null;
  private timeout?: ReturnType<typeof setTimeout>;
  private duration?: ReturnType<typeof setTimeout>;
  private disconnectTimeout?: ReturnType<typeof setTimeout>;
  private handingOff = false;
  constructor(
    private stream: MediaStream,
    private token: string,
    private onChange: (state: CallSnapshot) => void,
    private onHandoff: () => void,
  ) {}
  private change(next: Partial<CallSnapshot>) {
    if (!this.disposed) {
      this.snapshot = { ...this.snapshot, ...next };
      this.onChange(this.snapshot);
    }
  }
  private async request(method: string, body?: object, keepalive = false) {
    const response = await fetch(
      `/api/azera/voice/realtime${this.id ? `?id=${this.id}` : ""}`,
      {
        method,
        keepalive,
        headers: {
          "Content-Type": "application/json",
          "X-Azera-Chat-Token": this.token,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(25_000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "Voice assistance is temporarily unavailable",
      );
    return data;
  }
  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.timeout = setTimeout(
      () =>
        void this.fail(
          "The voice connection timed out. Please try again or message us here.",
        ),
      30_000,
    );
    try {
      const pc = new RTCPeerConnection();
      this.pc = pc;
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "");
      this.audio = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void this.resumeAudio();
      };
      pc.onconnectionstatechange = () => {
        if (this.finished) return;
        if (pc.connectionState === "connected") {
          clearTimeout(this.disconnectTimeout);
          clearTimeout(this.timeout);
          this.change({ state: "active" });
          void this.request("PATCH").catch(() => {
            if (!this.finished)
              void this.fail(
                "The call could not be confirmed. Please reconnect.",
              );
          });
        } else if (["failed", "closed"].includes(pc.connectionState))
          void this.fail(
            "The voice call disconnected. You can message us here instead.",
          );
        else if (pc.connectionState === "disconnected") {
          clearTimeout(this.disconnectTimeout);
          this.disconnectTimeout = setTimeout(
            () =>
              void this.fail(
                "The voice connection was lost. Please reconnect or message us here.",
              ),
            12_000,
          );
        }
      };
      this.stream
        .getAudioTracks()
        .forEach((track) => pc.addTrack(track, this.stream));
      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onopen = () =>
        dc.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Greet the caller briefly. Introduce yourself as Azera, MartPoint’s AI voice assistant, and ask how you can help.",
            },
          }),
        );
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === "response.function_call_arguments.done" &&
            data.name === "request_human" &&
            !this.handingOff
          ) {
            this.handingOff = true;
            void this.end().then((ended) => {
              if (ended && !this.disposed) this.onHandoff();
              else this.handingOff = false;
            });
          } else if (data.type === "error")
            void this.fail(
              "Voice assistance was interrupted. Please try again or message us here.",
            );
        } catch {
          /* Ignore unrecognised provider events, not application data. */
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      const result = await this.request("POST", {
        sdp: pc.localDescription?.sdp,
      });
      this.id = result.id;
      if (this.finished) {
        await this.request("DELETE", undefined, true);
        return;
      }
      this.duration = setTimeout(
        () => void this.end(),
        Math.min(600, result.maxSeconds || 600) * 1000,
      );
      await pc.setRemoteDescription({ type: "answer", sdp: result.answer });
    } catch (error) {
      if (!this.finished)
        await this.fail(
          error instanceof Error
            ? error.message
            : "Voice assistance could not connect",
        );
    }
  }
  toggleMute() {
    const muted = !this.snapshot.isMuted;
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.change({ isMuted: muted });
  }
  async resumeAudio() {
    try {
      await this.audio?.play();
      this.change({ audioBlocked: false });
    } catch {
      this.change({ audioBlocked: true });
    }
  }
  async end() {
    this.finished = true;
    this.release();
    try {
      if (this.id) await this.request("DELETE", undefined, true);
      this.change({ state: "ended", error: null });
      return true;
    } catch {
      this.change({
        state: "error",
        error:
          "Your microphone is off, but shutdown could not be confirmed. Please retry End call.",
      });
      return false;
    }
  }
  private async fail(message: string) {
    const closed = await this.end();
    this.change({
      state: "error",
      error:
        message + (closed ? "" : " Shutdown is unconfirmed; retry End call."),
    });
  }
  private release() {
    clearTimeout(this.timeout);
    clearTimeout(this.duration);
    clearTimeout(this.disconnectTimeout);
    this.stream.getTracks().forEach((track) => track.stop());
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.close();
      this.pc = null;
    }
    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onmessage = null;
      this.dc.close();
      this.dc = null;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.started) void this.end();
  }
}
