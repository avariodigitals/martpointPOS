import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
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

type Scene = { scene_number: number; duration_seconds: number; use_product_image: boolean; visual_prompt: string }
type DirectorPlan = {
  scenes: Scene[]
  overlays: { scene_number: number; text: string }[]
  voiceover_script: string
  meta_ad_copy: { primary_text: string; headline: string; call_to_action: "SHOP_NOW" }
}

const failure = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers: { "cache-control": "no-store" } })
const VIDEO_MODEL = process.env.AI_ADS_VIDEO_MODEL || "gemini-omni-1.2-flash"
const DIRECTOR_MODEL = process.env.AI_ADS_DIRECTOR_MODEL || "gemini-4-hydrogen"
const runFile = promisify(execFile)
const directorPrompt = `You are an elite Meta (Facebook and Instagram) direct-response media buyer and creative director. Turn the merchant's description into a high-converting 12-to-15 second vertical 9:16 video ad blueprint. Do not invent prices, guarantees, product properties, testimonials, or scarcity. Never make claims the merchant did not provide. Return only valid JSON matching this schema: {"scenes":[{"scene_number":1,"duration_seconds":4,"use_product_image":false,"visual_prompt":"Detailed scroll-stopping visual hook. Explicitly specify NO text, NO logos, NO watermarks, and NO words on screen."},{"scene_number":2,"duration_seconds":5,"use_product_image":true,"visual_prompt":"Show the product in action, solving the stated pain point or showing its use. Explicitly specify NO text, NO logos, NO watermarks, and NO words on screen."},{"scene_number":3,"duration_seconds":4,"use_product_image":true,"visual_prompt":"Show the customer outcome or final product showcase. Explicitly specify NO text, NO logos, NO watermarks, and NO words on screen."}],"overlays":[{"scene_number":1,"text":"3-6 word hook"},{"scene_number":2,"text":"3-6 word benefit"},{"scene_number":3,"text":"3-5 word offer and call to action"}],"voiceover_script":"A natural, conversational 25-32 word direct-response script ending with a clear call to action.","meta_ad_copy":{"primary_text":"Two or three short lines with a truthful problem, solution and CTA.","headline":"A short 3-5 word headline","call_to_action":"SHOP_NOW"}}. Keep the scene durations exactly 4, 5, and 4 seconds. Adapt the copy and scenes to the merchant's stated destination and goal.`

function interactionText(result: Record<string, unknown>): string {
  if (typeof result.output_text === "string") return result.output_text
  const steps = Array.isArray(result.steps) ? result.steps as Array<Record<string, unknown>> : []
  for (const step of steps) {
    if (step.type !== "model_output" || !Array.isArray(step.content)) continue
    const part = (step.content as Array<Record<string, unknown>>).find((item) => item.type === "text" && typeof item.text === "string")
    if (part) return String(part.text)
  }
  return ""
}

function validatePlan(value: unknown): DirectorPlan {
  if (!value || typeof value !== "object") throw new Error("The ad plan could not be checked.")
  const plan = value as Record<string, unknown>
  if (!Array.isArray(plan.scenes) || plan.scenes.length !== 3 || !Array.isArray(plan.overlays) || plan.overlays.length !== 3) throw new Error("The ad plan was incomplete. Please try again.")
  const expected = [4, 5, 4]
  const scenes = plan.scenes.map((raw, index) => {
    const item = raw as Record<string, unknown>
    if (item.scene_number !== index + 1 || item.duration_seconds !== expected[index] || typeof item.visual_prompt !== "string" || item.visual_prompt.length < 20 || item.visual_prompt.length > 2000) throw new Error("The ad plan was incomplete. Please try again.")
    return { scene_number: index + 1, duration_seconds: expected[index], use_product_image: Boolean(item.use_product_image), visual_prompt: item.visual_prompt }
  })
  const overlays = plan.overlays.map((raw, index) => {
    const item = raw as Record<string, unknown>
    if (item.scene_number !== index + 1 || typeof item.text !== "string" || item.text.trim().length < 3 || item.text.length > 60) throw new Error("The ad plan was incomplete. Please try again.")
    return { scene_number: index + 1, text: item.text.trim() }
  })
  const script = typeof plan.voiceover_script === "string" ? plan.voiceover_script.trim() : ""
  const copy = plan.meta_ad_copy as Record<string, unknown> | undefined
  const wordCount = script.split(/\s+/).length
  if (wordCount < 25 || wordCount > 32 || script.length > 600 || !copy || typeof copy.primary_text !== "string" || typeof copy.headline !== "string" || copy.call_to_action !== "SHOP_NOW") throw new Error("The ad plan was incomplete. Please try again.")
  return { scenes, overlays, voiceover_script: script, meta_ad_copy: { primary_text: copy.primary_text.slice(0, 2000), headline: copy.headline.slice(0, 255), call_to_action: "SHOP_NOW" } }
}

async function geminiInteraction(apiKey: string, payload: Record<string, unknown>, signal: AbortSignal) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(payload), signal, cache: "no-store",
  })
  const json = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !json) throw new Error(`Gemini interaction failed (${response.status}).`)
  return json
}

async function deleteGeminiInteraction(apiKey: string, id: unknown) {
  if (typeof id !== "string" || !id) return
  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(5000), cache: "no-store",
    })
  } catch {
    // Cleanup is best-effort: a completed creative must remain deliverable if
    // Google's interaction-record deletion endpoint is temporarily unavailable.
    console.warn("[AI Ads] Gemini interaction cleanup was unavailable")
  }
}

async function waitForInteraction(apiKey: string, initial: Record<string, unknown>, signal: AbortSignal) {
  let interaction = initial
  let id = typeof initial.id === "string" ? initial.id : ""
  if (!id) throw new Error("Gemini did not return an interaction ID.")
  const state = () => String(interaction.status || "").toLowerCase()
  while (state() === "in_progress" || state() === "queued" || state() === "running" || !state()) {
    if (signal.aborted) throw new Error("Video generation took too long. Please try again.")
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 5000)
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Video generation took too long. Please try again.")) }, { once: true })
    })
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(id)}`, { headers: { "x-goog-api-key": apiKey }, signal, cache: "no-store" })
    const json = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !json) throw new Error(`Gemini polling failed (${response.status}).`)
    interaction = json
  }
  if (state() !== "completed") throw new Error("Gemini could not finish a video scene.")
  return interaction
}

type VideoContent = { data: string; uri?: never } | { uri: string; data?: never }

function findVideo(result: Record<string, unknown>): VideoContent | null {
  const steps = Array.isArray(result.steps) ? result.steps as Array<Record<string, unknown>> : []
  for (const step of steps) {
    if (step.type !== "model_output" || !Array.isArray(step.content)) continue
    for (const raw of step.content as Array<Record<string, unknown>>) {
      if (raw.type !== "video") continue
      if (typeof raw.data === "string") return { data: raw.data }
      if (typeof raw.uri === "string") return { uri: raw.uri }
      if (raw.file && typeof raw.file === "object" && typeof (raw.file as Record<string, unknown>).uri === "string") return { uri: String((raw.file as Record<string, unknown>).uri) }
    }
  }
  const out = result.output_video as Record<string, unknown> | undefined
  if (typeof out?.data === "string") return { data: out.data }
  if (typeof out?.uri === "string") return { uri: out.uri }
  return null
}

async function videoBytes(apiKey: string, result: Record<string, unknown>, signal: AbortSignal) {
  const video = findVideo(result)
  if (!video) throw new Error("Gemini did not return a video file.")
  if (typeof video.data === "string") return Buffer.from(video.data, "base64")
  const videoUri = video.uri
  if (!/^https:\/\//i.test(videoUri)) throw new Error("Gemini returned a video location that cannot be downloaded by this service.")
  const response = await fetch(videoUri, { headers: { "x-goog-api-key": apiKey }, signal, cache: "no-store" })
  if (!response.ok) throw new Error(`Gemini video download failed (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

function escapeFilter(value: string) { return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'").replaceAll(",", "\\,").replaceAll("[", "\\[").replaceAll("]", "\\]") }

async function createVideo(providerKey: string, openAiKey: string, prompt: string, reference: string, mime: string) {
  // Leave room inside the route's 240-second hard limit for TTS, rendering,
  // interaction cleanup, and the Central/Fleet response handoff.
  const totalDeadline = AbortSignal.timeout(170000)
  const directorInput: Array<Record<string, string>> = []
  if (reference && mime.startsWith("image/")) directorInput.push({ type: "image", data: reference, mime_type: mime })
  directorInput.push({ type: "text", text: `Merchant brief:\n${prompt}` })
  const director = await geminiInteraction(providerKey, { model: DIRECTOR_MODEL, system_instruction: directorPrompt, input: directorInput, response_format: { type: "json_object" } }, totalDeadline)
  const rawPlan = interactionText(director)
  let plan: DirectorPlan
  try { plan = validatePlan(JSON.parse(rawPlan)) } catch (error) { throw error instanceof Error ? error : new Error("The ad plan was invalid.") }
  finally { await deleteGeminiInteraction(providerKey, director.id) }

  const jobs = plan.scenes.map(async (scene) => {
    const input: Array<Record<string, string>> = []
    if (scene.use_product_image && reference && mime.startsWith("image/")) input.push({ type: "image", data: reference, mime_type: mime })
    input.push({ type: "text", text: `${scene.visual_prompt}\nVertical 9:16, realistic commercial video, exactly ${scene.duration_seconds} seconds, no captions or visible lettering.` })
    const started = await geminiInteraction(providerKey, { model: VIDEO_MODEL, input, background: true, response_format: { type: "video", duration: `${scene.duration_seconds}s`, resolution: "720p", aspect_ratio: "9:16", delivery: "inline" } }, totalDeadline)
    try {
      const completed = await waitForInteraction(providerKey, started, totalDeadline)
      return await videoBytes(providerKey, completed, totalDeadline)
    } finally {
      await deleteGeminiInteraction(providerKey, started.id)
    }
  })
  const clips = await Promise.all(jobs)

  const openai = new OpenAI({ apiKey: openAiKey, timeout: 25000 })
  const speech = await openai.audio.speech.create({ model: process.env.AI_ADS_TTS_MODEL || "gpt-4o-mini-tts", voice: "coral", input: plan.voiceover_script, response_format: "mp3" })
  const speechBytes = Buffer.from(await speech.arrayBuffer())

  const ffmpeg = process.env.AI_ADS_FFMPEG_PATH || "ffmpeg"
  const font = process.env.AI_ADS_FONT_PATH || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
  const dir = await mkdtemp(path.join(os.tmpdir(), "mp-ai-ads-"))
  try {
    const clipPaths = await Promise.all(clips.map(async (bytes, i) => { const file = path.join(dir, `scene-${i + 1}.mp4`); await writeFile(file, bytes); return file }))
    const speechPath = path.join(dir, "voiceover.mp3"); await writeFile(speechPath, speechBytes)
    const textPaths = await Promise.all(plan.overlays.map(async (overlay, i) => { const file = path.join(dir, `overlay-${i + 1}.txt`); await writeFile(file, overlay.text, "utf8"); return file }))
    const args = ["-y", "-i", clipPaths[0], "-i", clipPaths[1], "-i", clipPaths[2], "-i", speechPath]
    const filters = [
      "[0:v]trim=duration=4,setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v0]",
      "[1:v]trim=duration=5,setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v1]",
      "[2:v]trim=duration=4,setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v2]",
      "[v0][v1][v2]concat=n=3:v=1:a=0[base]",
    ]
    const bounds = [[0, 4], [4, 9], [9, 13]]
    let current = "base"
    for (let i = 0; i < textPaths.length; i++) {
      const next = `v${i + 1}`
      const file = escapeFilter(textPaths[i])
      const fontFile = escapeFilter(font)
      filters.push(`[${current}]drawtext=fontfile='${fontFile}':textfile='${file}':fontcolor=white:fontsize=52:line_spacing=8:box=1:boxcolor=black@0.65:boxborderw=24:x=(w-text_w)/2:y=h*0.32-text_h/2:enable='between(t,${bounds[i][0]},${bounds[i][1]})'[${next}]`)
      current = next
    }
    filters.push(`[3:a]atrim=duration=13,asetpts=PTS-STARTPTS,apad=pad_dur=13[aout]`)
    args.push("-filter_complex", filters.join(";"), "-map", `[${current}]`, "-map", "[aout]", "-t", "13", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path.join(dir, "final.mp4"))
    await runFile(ffmpeg, args, { timeout: 25000, maxBuffer: 1024 * 1024 })
    const resultBytes = await readFile(path.join(dir, "final.mp4"))
    if (resultBytes.length < 1000 || resultBytes.length > 24 * 1024 * 1024) throw new Error("The finished video is outside the supported file size.")
    return { bytes: resultBytes, plan }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function POST(request: Request) {
  const raw = await request.text()
  const requestPath = new URL(request.url).pathname
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", requestPath)) return failure("Unauthorized", 401)
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
      if (!provider?.apiKey) return failure("Image generation is temporarily unavailable. Please contact MartPoint support.", 503)
      const client = new OpenAI({ apiKey: provider.apiKey, timeout: 220000 })
      const result = await client.images.generate({ model: process.env.AI_ADS_IMAGE_MODEL || "gpt-image-2", prompt, n: 1, size: aspectRatio === "9:16" ? "1024x1536" : aspectRatio === "16:9" ? "1536x1024" : "1024x1024", quality: "medium", output_format: "jpeg" })
      const image = result.data?.[0]?.b64_json
      if (!image) return failure("The image provider did not return an image. Try a simpler description.", 502)
      return NextResponse.json({ success: true, kind, mime_type: "image/jpeg", data_base64: image, model: process.env.AI_ADS_IMAGE_MODEL || "gpt-image-2" }, { headers: { "cache-control": "no-store" } })
    }

    const gemini = await getAiProviderCredentials("gemini")
    const openai = await getAiProviderCredentials("openai")
    if (!gemini?.apiKey || !openai?.apiKey) return failure("Video creation is temporarily unavailable. Please contact MartPoint support.", 503)
    const reference = body.reference_media_base64 || ""
    if (reference && (reference.length > 5_600_000 || !body.reference_media_mime || !["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(body.reference_media_mime))) return failure("Choose a JPG, PNG, WebP photo or MP4 clip under 4 MB.", 400)
    if (reference && body.reference_media_mime?.startsWith("video/")) return failure("For the first version of AI video creation, choose a product photo. You can still upload video clips as campaign media.", 400)
    const result = await createVideo(gemini.apiKey, openai.apiKey, prompt, reference, body.reference_media_mime || "")
    return NextResponse.json({ success: true, kind, mime_type: "video/mp4", data_base64: result.bytes.toString("base64"), director: result.plan, model: VIDEO_MODEL, director_model: DIRECTOR_MODEL }, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    console.error("[AI Ads media generation] failed", error instanceof Error ? error.message : "unknown error")
    return failure("We couldn’t finish that creative right now. Please try again later.", 503)
  }
}
