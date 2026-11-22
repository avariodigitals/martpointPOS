import { NextResponse } from "next/server"
import OpenAI from "openai"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { getAiProviderCredentials } from "@/lib/ai-chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 240

type MediaRequest = {
  kind?: "image" | "video"
  prompt?: string
  aspect_ratio?: "1:1" | "9:16" | "16:9"
  reference_media_base64?: string
  reference_media_mime?: "image/jpeg" | "image/png" | "image/webp" | "video/mp4"
}

const failure = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers: { "cache-control": "no-store" } })

export async function POST(request: Request) {
  const raw = await request.text()
  const path = new URL(request.url).pathname
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", path)) return failure("Unauthorized", 401)
  if (process.env.AI_ADS_CREATIVE_ENABLED !== "true") return failure("AI Ads creative generation has not been released yet.", 503)

  let body: MediaRequest
  try { body = JSON.parse(raw) as MediaRequest } catch { return failure("Invalid request", 400) }
  const kind = body.kind
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!kind || !["image", "video"].includes(kind) || prompt.length < 8 || prompt.length > 3000) return failure("Choose an image or video and provide a clear description.", 400)
  const aspectRatio = body.aspect_ratio && ["1:1", "9:16", "16:9"].includes(body.aspect_ratio) ? body.aspect_ratio : "1:1"

  try {
    if (kind === "image") {
      const provider = await getAiProviderCredentials("openai")
      if (!provider?.apiKey) return failure("OpenAI is not configured in Next Admin → Settings → AI Provider Configuration.", 503)
      const client = new OpenAI({ apiKey: provider.apiKey, timeout: 220000 })
      const result = await client.images.generate({
        model: process.env.AI_ADS_IMAGE_MODEL || "gpt-image-2",
        prompt,
        n: 1,
        size: aspectRatio === "9:16" ? "1024x1536" : aspectRatio === "16:9" ? "1536x1024" : "1024x1024",
        quality: "medium",
        output_format: "jpeg",
      })
      const image = result.data?.[0]?.b64_json
      if (!image) return failure("The image provider did not return an image. Try a simpler description.", 502)
      return NextResponse.json({ success: true, kind, mime_type: "image/jpeg", data_base64: image, model: process.env.AI_ADS_IMAGE_MODEL || "gpt-image-2" }, { headers: { "cache-control": "no-store" } })
    }

    const provider = await getAiProviderCredentials("gemini")
    if (!provider?.apiKey) return failure("Gemini is not configured in Next Admin → Settings → AI Provider Configuration.", 503)
    const input: Array<Record<string, string>> = []
    const reference = body.reference_media_base64 || ""
    if (reference) {
      if (reference.length > 5_600_000 || !body.reference_media_mime || !["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(body.reference_media_mime)) return failure("Choose a JPG, PNG, WebP photo or MP4 clip under 4 MB.", 400)
      input.push({ type: body.reference_media_mime.startsWith("video/") ? "video" : "image", data: reference, mime_type: body.reference_media_mime })
    }
    input.push({ type: "text", text: prompt })
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": provider.apiKey },
      body: JSON.stringify({
        model: process.env.AI_ADS_VIDEO_MODEL || "gemini-omni-1.2-flash",
        input,
        response_format: { type: "video", duration: "10s", resolution: "720p", aspect_ratio: aspectRatio === "1:1" ? "9:16" : aspectRatio },
      }),
      signal: AbortSignal.timeout(220000),
      cache: "no-store",
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !result) {
      console.error("[AI Ads video provider] request failed", response.status, result?.error ? "provider error returned" : "unreadable response")
      return failure("Video generation is temporarily unavailable. Please try again later.", 502)
    }
    let videoBase64 = typeof (result.output_video as Record<string, unknown> | undefined)?.data === "string" ? String((result.output_video as Record<string, unknown>).data) : ""
    const steps = Array.isArray(result.steps) ? result.steps as Array<Record<string, unknown>> : []
    for (const step of steps) {
      if (step.type !== "model_output" || !Array.isArray(step.content)) continue
      const video = (step.content as Array<Record<string, unknown>>).find((part) => part.type === "video" && typeof part.data === "string")
      if (video) { videoBase64 = String(video.data); break }
    }
    if (!videoBase64 || videoBase64.length > 32_000_000) return failure("The video provider did not return a usable clip. Try again later.", 502)
    return NextResponse.json({ success: true, kind, mime_type: "video/mp4", data_base64: videoBase64, model: process.env.AI_ADS_VIDEO_MODEL || "gemini-omni-1.2-flash" }, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    console.error("[AI Ads media generation] failed", error instanceof Error ? error.message : "unknown error")
    return failure("Creative generation is temporarily unavailable. Please try again later.", 503)
  }
}
