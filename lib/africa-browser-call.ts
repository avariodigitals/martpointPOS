import type { AfricaClient } from "africastalking-client"
import { requestCallMicrophone } from "@/lib/azera-webrtc"
import type { PhoneCallSnapshot } from "@/lib/azera-phone-call"

/** The provider owns the telephone/media legs. No tel: link or second provider. */
export class AfricaBrowserCall {
  snapshot: PhoneCallSnapshot = {
    state: "connecting",
    error: null,
    muted: false,
    audioBlocked: false,
    setupRequired: false,
  }
  disposed = false
  private started = false
  private finished = false
  private client: AfricaClient | null = null
  private id: string | null = null
  private deadline?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private heartbeatBusy = false
  private heartbeatFailures = 0
  private accepted = false
  private receiverPaused = false
  private remoteAudio: HTMLAudioElement | null = null
  private audioReady = () => {
    void this.resumeAudio()
  }
  constructor(
    private conversationId: string,
    private onChange: (snapshot: PhoneCallSnapshot) => void
  ) {}
  private change(value: Partial<PhoneCallSnapshot>) {
    if (!this.disposed) {
      this.snapshot = { ...this.snapshot, ...value }
      this.onChange(this.snapshot)
    }
  }
  private async status(status: string) {
    if (!this.id) return
    const send = () =>
      fetch(`/api/azera/calls/${this.id}/africa-browser`, {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(10_000),
      })
    let response = await send()
    if (response.status === 409 && status !== "active") response = await send()
    if (!response.ok)
      throw new Error(
        "Could not save call history. Refresh Call Reports to check the latest status."
      )
  }
  async start() {
    if (this.started || this.disposed) return
    this.started = true
    try {
      if (typeof window !== "undefined") {
        const pending: Promise<unknown>[] = []
        this.receiverPaused = true
        window.dispatchEvent(new CustomEvent("azera:outbound-start", { detail: { waitUntil: (value: Promise<unknown>) => pending.push(value) } }))
        await Promise.all(pending)
      }
      // Ask permission before creating a paid-call capability. The SDK then
      // opens its own media stream; do not hold two microphone streams open.
      const stream = await requestCallMicrophone()
      stream.getTracks().forEach((track) => track.stop())
      if (this.finished) return
      const response = await fetch("/api/azera/calls/africa-browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: this.conversationId }),
        signal: AbortSignal.timeout(25_000),
      })
      const prepared = await response.json()
      if (!response.ok) {
        this.change({ setupRequired: response.status === 503 })
        throw new Error(prepared.error || "Could not prepare browser calling.")
      }
      this.id = prepared.id
      if (this.finished) {
        await this.status("ended")
        return
      }
      const { default: sdk } = await import("africastalking-client")
      if (this.finished) {
        await this.status("ended")
        return
      }
      const client = new sdk.Client(prepared.token)
      this.client = client
      let dialled = false
      client.on("ready", () => {
        if (this.finished || dialled) return
        dialled = true
        this.remoteAudio =
          typeof document !== "undefined"
            ? (document.getElementById(
                "remote-stream-audio"
              ) as HTMLAudioElement | null)
            : null
        this.remoteAudio?.setAttribute("playsinline", "")
        this.remoteAudio?.addEventListener("loadedmetadata", this.audioReady)
        try {
          client.call(prepared.phone)
          this.change({ state: "ringing" })
        } catch {
          void this.fail("The phone call could not start. Please try again.")
        }
      })
      client.on("callaccepted", () => {
        if (this.finished || this.accepted) return
        this.accepted = true
        clearTimeout(this.deadline)
        this.change({ state: "active" })
        void this.resumeAudio()
        void this.status("active").catch((error: Error) =>
          this.change({ error: error.message })
        )
        this.heartbeat = setInterval(() => void this.keepCallSession(), 30_000)
      })
      client.on("hangup", () => {
        if (this.finished) return
        this.finished = true
        this.release()
        this.change({ state: "ended", held: false })
        void this.status(this.accepted ? "ended" : "missed").catch(
          (error: Error) => this.change({ error: error.message })
        )
      })
      for (const event of ["notready", "offline", "closed"])
        client.on(event, () => {
          if (!this.finished)
            void this.fail(
              "The Africa’s Talking voice connection is unavailable. Check the account’s WebRTC activation and try again."
            )
        })
      this.deadline = setTimeout(
        () =>
          void this.fail(
            "The customer could not be reached. Please try again later.",
            "missed"
          ),
        75_000
      )
    } catch (error) {
      if (!this.finished)
        await this.fail(
          error instanceof Error ? error.message : "Could not connect the call."
        )
    }
  }
  async toggleMute() {
    if (!this.client || this.finished) return
    try {
      if (this.snapshot.muted) this.client.unmute()
      else this.client.mute()
      this.change({ muted: !this.snapshot.muted })
    } catch {
      this.change({
        error: "The mute control could not be applied. Try again.",
      })
    }
  }
  private async keepCallSession() {
    if (this.finished || this.heartbeatBusy) return
    this.heartbeatBusy = true
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      })
      if (this.finished) return
      if (response.status === 401 || response.status === 403) {
        await this.fail(
          "Your staff session expired. Please sign in again before making another call."
        )
        return
      }
      if (!response.ok) throw new Error("Session heartbeat failed")
      if (!this.finished) await this.status("active")
      this.heartbeatFailures = 0
    } catch {
      if (!this.finished && ++this.heartbeatFailures >= 3)
        await this.fail(
          "The staff connection was lost. The browser voice session has closed; check your connection before calling again."
        )
    } finally {
      this.heartbeatBusy = false
    }
  }
  async toggleHold() {
    if (!this.client || this.snapshot.state !== "active") return
    try {
      if (this.snapshot.held) this.client.unhold()
      else this.client.hold()
      this.change({ held: !this.snapshot.held })
    } catch {
      this.change({ error: "Could not change hold. Try again." })
    }
  }
  dtmf(digit: string) {
    if (
      this.client &&
      this.snapshot.state === "active" &&
      /^[0-9*#]$/.test(digit)
    )
      this.client.dtmf(digit)
  }
  async resumeAudio() {
    if (!this.remoteAudio?.srcObject) return
    try {
      await this.remoteAudio.play()
      this.change({ audioBlocked: false })
    } catch {
      this.change({ audioBlocked: true })
    }
  }
  async end() {
    this.finished = true
    try {
      this.client?.hangup()
      this.release()
      await this.status("ended")
      this.change({ state: "ended", held: false, error: null })
      return true
    } catch {
      this.release()
      this.change({
        state: "error",
        error:
          "Your browser voice session has closed. Call history could not be confirmed; click End call to retry saving.",
      })
      return false
    }
  }
  private async fail(error: string, status = "failed") {
    this.finished = true
    try {
      this.client?.hangup()
    } catch {
      /* destroy below closes media */
    }
    this.release()
    try {
      await this.status(status)
    } catch {
      error += " Call history could not be confirmed."
    }
    this.change({ state: "error", error })
  }
  private release() {
    clearTimeout(this.deadline)
    clearInterval(this.heartbeat)
    this.remoteAudio?.removeEventListener("loadedmetadata", this.audioReady)
    if (this.remoteAudio) {
      this.remoteAudio.pause()
      this.remoteAudio.srcObject = null
      this.remoteAudio = null
    }
    const client = this.client
    this.client = null
    try {
      client?.destroy()
    } catch {
      /* best effort SDK cleanup */
    }
    if (this.receiverPaused && typeof window !== "undefined") {
      this.receiverPaused = false
      window.dispatchEvent(new Event("azera:outbound-end"))
    }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (!this.finished) void this.end()
    else this.release()
  }
}
