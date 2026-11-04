"use client"

type Consent = { path: string; token: string; uploadUrl: string }

/** Captures the two browser audio legs only after the staff member records consent. */
export async function startAzeraBrowserRecording(callId: string, local: MediaStream, remote: MediaStream) {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported("audio/webm")) throw new Error("This browser does not support call recording.")
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) throw new Error("This browser cannot mix both call audio legs for recording.")
  const context = new AudioContextClass()
  await context.resume()
  const destination = context.createMediaStreamDestination()
  const sources = [local, remote].map((stream) => context.createMediaStreamSource(stream))
  sources.forEach((source) => source.connect(destination))
  const response = await fetch(`/api/azera/calls/${encodeURIComponent(callId)}/recording`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "consent", recipientAgreed: true }),
  })
  const consent = await response.json() as Consent & { error?: string }
  if (!response.ok) {
    sources.forEach((source) => source.disconnect())
    destination.stream.getTracks().forEach((track) => track.stop())
    await context.close()
    throw new Error(consent.error || "Recording consent could not be saved.")
  }
  const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type))
  const storageMimeType = "audio/webm"
  if (!mimeType) {
    sources.forEach((source) => source.disconnect())
    await context.close()
    throw new Error("This browser does not support call recording.")
  }
  const recorder = new MediaRecorder(destination.stream, { mimeType })
  const chunks: BlobPart[] = []
  const startedAt = Date.now()
  let stopped: Promise<void> | null = null
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const stop = () => {
    if (stopped) return stopped
    stopped = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("stop", async () => {
        try {
          const blob = new Blob(chunks, { type: mimeType })
          const uploaded = await fetch(consent.uploadUrl, { method: "PUT", headers: { "Content-Type": storageMimeType, "x-upsert": "false" }, body: blob })
          if (!uploaded.ok) throw new Error("The call audio could not be uploaded to private storage.")
          const complete = await fetch(`/api/azera/calls/${encodeURIComponent(callId)}/recording`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete", path: consent.path, mimeType: storageMimeType, size: blob.size, durationSeconds: (Date.now() - startedAt) / 1000 }),
          })
          const result = await complete.json()
          if (!complete.ok) throw new Error(result.error || "The call recording note could not be finalized.")
          resolve()
        } catch (error) { reject(error) }
        finally {
          destination.stream.getTracks().forEach((track) => track.stop())
          sources.forEach((source) => source.disconnect())
          await context.close().catch(() => {})
        }
      }, { once: true })
      if (recorder.state !== "inactive") recorder.stop()
      else resolve()
    })
    return stopped
  }
  recorder.start(1000)
  return { stop }
}
