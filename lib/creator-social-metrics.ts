import crypto from "crypto"
import { supabase } from "@/lib/supabase"

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"

type TikTokTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  open_id?: string
  scope?: string
  error?: string
  error_description?: string
}

function encryptionKey(): Buffer {
  const encoded = process.env.CREATOR_SOCIAL_TOKEN_ENCRYPTION_KEY || ""
  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32) throw new Error("CREATOR_SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
  return key
}

export function encryptSocialToken(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".")
}

export function decryptSocialToken(value: string): string {
  const [ivText, tagText, cipherText] = value.split(".")
  if (!ivText || !tagText || !cipherText) throw new Error("Stored social token is malformed")
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(cipherText, "base64url")), decipher.final()]).toString("utf8")
}

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.CREATOR_SOCIAL_TOKEN_ENCRYPTION_KEY)
}

export function tiktokRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/api/creator/social-accounts/tiktok/callback`
}

export function parseTikTokVideoId(contentUrl: string): string | null {
  try {
    const url = new URL(contentUrl)
    if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) return null
    return url.pathname.match(/\/video\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export async function refreshTikTokConnection(connection: Record<string, unknown>): Promise<{ accessToken: string; connection: Record<string, unknown> }> {
  const expiresAt = connection.access_token_expires_at ? new Date(String(connection.access_token_expires_at)).getTime() : 0
  if (expiresAt > Date.now() + 5 * 60_000) {
    return { accessToken: decryptSocialToken(String(connection.access_token_ciphertext)), connection }
  }
  if (!connection.refresh_token_ciphertext || !process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok authorization needs to be renewed")
  }
  const form = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: decryptSocialToken(String(connection.refresh_token_ciphertext)),
  })
  const response = await fetch(TIKTOK_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" })
  const token = await response.json() as TikTokTokenResponse
  if (!response.ok || !token.access_token || !token.refresh_token) throw new Error(token.error_description || "TikTok token refresh failed")
  const updated = {
    access_token_ciphertext: encryptSocialToken(token.access_token),
    refresh_token_ciphertext: encryptSocialToken(token.refresh_token),
    access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(),
    refresh_token_expires_at: new Date(Date.now() + Number(token.refresh_expires_in || 0) * 1000).toISOString(),
    scopes: (token.scope || "").split(",").filter(Boolean),
    status: "CONNECTED",
    updated_at: new Date().toISOString(),
    last_sync_error: null,
  }
  const { error } = await supabase.from("creator_social_connections").update(updated).eq("id", String(connection.id))
  if (error) throw new Error("Could not save refreshed TikTok authorization")
  return { accessToken: token.access_token, connection: { ...connection, ...updated } }
}

export async function syncTikTokMetrics(): Promise<{ connections: number; checked: number; snapshots: number; errors: number }> {
  const stats = { connections: 0, checked: 0, snapshots: 0, errors: 0 }
  const { data: connections, error } = await supabase.from("creator_social_connections")
    .select("id, creator_id, platform_user_id, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at, refresh_token_expires_at, status")
    .eq("platform", "TIKTOK").eq("status", "CONNECTED").limit(200)
  if (error) throw new Error(error.message)
  for (const initial of connections ?? []) {
    stats.connections++
    try {
      const refreshed = await refreshTikTokConnection(initial as Record<string, unknown>)
      const { data: submissions, error: submissionsError } = await supabase.from("creator_submissions")
        .select("id, content_url").eq("creator_id", initial.creator_id).eq("platform", "TIKTOK")
        .in("status", ["PENDING", "APPROVED"]).order("submitted_at", { ascending: false }).limit(100)
      if (submissionsError) throw new Error(submissionsError.message)
      const mapped = (submissions ?? []).map((submission) => ({ submission, videoId: parseTikTokVideoId(String(submission.content_url || "")) })).filter((x): x is { submission: typeof x.submission; videoId: string } => Boolean(x.videoId))
      for (let offset = 0; offset < mapped.length; offset += 20) {
        const batch = mapped.slice(offset, offset + 20)
        const fields = "id,like_count,comment_count,share_count,view_count"
        const response = await fetch(`https://open.tiktokapis.com/v2/video/query/?fields=${fields}`, {
          method: "POST", headers: { Authorization: `Bearer ${refreshed.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ filters: { video_ids: batch.map((item) => item.videoId) } }), cache: "no-store",
        })
        const result = await response.json() as { data?: { videos?: Array<{ id: string; view_count?: number; like_count?: number; comment_count?: number; share_count?: number }> }; error?: { code?: string; message?: string } }
        if (!response.ok || (result.error?.code && result.error.code !== "ok")) throw new Error(result.error?.message || "TikTok metrics request failed")
        const byId = new Map((result.data?.videos || []).map((video) => [video.id, video]))
        for (const item of batch) {
          stats.checked++
          const video = byId.get(item.videoId)
          if (!video) continue
          const metric = { views: Number(video.view_count || 0), likes: Number(video.like_count || 0), comments: Number(video.comment_count || 0), shares: Number(video.share_count || 0) }
          const { data: previous } = await supabase.from("creator_submission_metrics").select("views, likes, comments, shares")
            .eq("submission_id", item.submission.id).eq("source", "API").order("captured_at", { ascending: false }).limit(1).maybeSingle()
          if (previous && Number(previous.views || 0) === metric.views && Number(previous.likes || 0) === metric.likes && Number(previous.comments || 0) === metric.comments && Number(previous.shares || 0) === metric.shares) continue
          const { error: insertError } = await supabase.from("creator_submission_metrics").insert({ submission_id: item.submission.id, source: "API", verified: true, snapshot_label: "tiktok-auto-sync", ...metric })
          if (insertError) throw new Error(insertError.message)
          stats.snapshots++
        }
      }
      await supabase.from("creator_social_connections").update({ last_synced_at: new Date().toISOString(), last_sync_error: null, updated_at: new Date().toISOString() }).eq("id", initial.id)
    } catch (syncError) {
      stats.errors++
      const message = syncError instanceof Error ? syncError.message.slice(0, 500) : "Social metrics sync failed"
      await supabase.from("creator_social_connections").update({ last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", initial.id)
      if (/authorization|refresh token|invalid_grant/i.test(message)) await supabase.from("creator_social_connections").update({ status: "REAUTH_REQUIRED" }).eq("id", initial.id)
    }
  }
  return stats
}
