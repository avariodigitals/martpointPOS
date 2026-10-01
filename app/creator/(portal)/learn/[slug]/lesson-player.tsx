"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react"

/* Tracks real watch progress:
 *  - <video> files: timeupdate → posts % every ~5s.
 *  - YouTube embeds: IFrame API — progress polls getCurrentTime/getDuration,
 *    completes on ENDED state.
 *  - Other embeds: manual "Mark as watched" (honest fallback; providers that
 *    expose no JS API cannot be tracked).
 */

interface Props {
  contentId: string
  type: string
  videoUrl: string | null
  externalUrl: string | null
  completed: boolean
  initialPct: number
}

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return m?.[1] ?? null
}

async function postProgress(contentId: string, action: string, videoPct?: number) {
  await fetch("/api/creator/learn/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentId, action, videoPct }),
  }).catch(() => {})
}

export function LessonPlayer({ contentId, type, videoUrl, externalUrl, completed, initialPct }: Props) {
  const router = useRouter()
  const [done, setDone] = useState(completed)
  const [pct, setPct] = useState(initialPct)
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytContainerRef = useRef<HTMLDivElement>(null)
  const lastPost = useRef(0)

  const ytId = videoUrl ? youTubeId(videoUrl) : null
  const isFileVideo =
    !!videoUrl && !ytId && /\.(mp4|webm|mov)(\?|#|$)/i.test(videoUrl)

  const reportPct = useCallback(
    (p: number, force = false) => {
      const now = Date.now()
      setPct((prev) => Math.max(prev, p))
      if (!force && now - lastPost.current < 5000) return
      lastPost.current = now
      void postProgress(contentId, "video-progress", p)
      if (p >= 90) setDone(true)
    },
    [contentId]
  )

  // Direct video file tracking
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      if (v.duration > 0) reportPct((v.currentTime / v.duration) * 100)
    }
    const onEnded = () => reportPct(100, true)
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("ended", onEnded)
    return () => {
      v.removeEventListener("timeupdate", onTime)
      v.removeEventListener("ended", onEnded)
    }
  }, [reportPct])

  // YouTube IFrame API tracking
  useEffect(() => {
    if (!ytId || !ytContainerRef.current) return
    let player: { getCurrentTime(): number; getDuration(): number; destroy(): void } | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const mount = () => {
      const YT = (window as unknown as { YT?: { Player: new (...a: unknown[]) => typeof player; PlayerState: { ENDED: number } } }).YT
      if (!YT || cancelled) return
      player = new YT.Player(ytContainerRef.current, {
        videoId: ytId,
        playerVars: { rel: 0 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.ENDED) reportPct(100, true)
          },
          onReady: () => {
            interval = setInterval(() => {
              if (player && player.getDuration() > 0) {
                reportPct((player.getCurrentTime() / player.getDuration()) * 100)
              }
            }, 5000)
          },
        },
      })
    }

    if ((window as unknown as { YT?: unknown }).YT) {
      mount()
    } else {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      ;(window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = mount
      document.body.appendChild(tag)
    }
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      try { player?.destroy() } catch {}
    }
  }, [ytId, reportPct])

  async function markComplete() {
    setBusy(true)
    await postProgress(contentId, "complete")
    setDone(true)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {type === "VIDEO" && videoUrl && (
        <>
          {ytId ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <div ref={ytContainerRef} className="h-full w-full" />
            </div>
          ) : isFileVideo ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full aspect-video rounded-xl bg-black"
            />
          ) : (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe src={videoUrl} className="h-full w-full" allowFullScreen title="Video lesson" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-retail transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-16 text-right">
              {done ? "Watched" : `${Math.round(pct)}%`}
            </span>
          </div>
          {!ytId && !isFileVideo && !done && (
            <Button variant="outline" size="sm" onClick={() => { reportPct(100, true); setDone(true) }}>
              Mark as watched
            </Button>
          )}
        </>
      )}

      {type === "LINK" && externalUrl && (
        <Button asChild variant="outline">
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { if (!done) void markComplete() }}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Open resource
          </a>
        </Button>
      )}

      {type !== "VIDEO" && type !== "LINK" && type !== "ASSESSMENT" && !done && (
        <Button onClick={markComplete} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Mark as complete
        </Button>
      )}

      {done && type !== "ASSESSMENT" && (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </p>
      )}
    </div>
  )
}
