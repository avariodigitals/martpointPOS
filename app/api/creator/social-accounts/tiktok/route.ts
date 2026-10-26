import crypto from "crypto"
import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { tiktokConfigured, tiktokRedirectUri } from "@/lib/creator-social-metrics"

export const dynamic = "force-dynamic"

export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { data, error } = await supabase.from("creator_social_connections")
    .select("id, platform, display_name, username, scopes, status, last_synced_at, last_sync_error, connected_at")
    .eq("creator_id", creator.id).eq("platform", "TIKTOK").maybeSingle()
  if (error) return NextResponse.json({ error: "Could not load social account status" }, { status: 500 })
  return NextResponse.json({ configured: tiktokConfigured(), connection: data ?? null })
}

export async function POST() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  if (!tiktokConfigured() || !process.env.TIKTOK_CLIENT_KEY) {
    return NextResponse.json({ error: "TikTok connection is not configured yet." }, { status: 503 })
  }

  const state = crypto.randomBytes(32).toString("base64url")
  const { error } = await supabase.from("creator_social_oauth_states").insert({
    state_hash: crypto.createHash("sha256").update(state).digest("hex"),
    creator_id: creator.id,
    platform: "TIKTOK",
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  })
  if (error) return NextResponse.json({ error: "Could not start TikTok authorization" }, { status: 500 })

  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/")
  authorize.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY)
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("scope", "user.info.basic,user.info.profile,video.list")
  authorize.searchParams.set("redirect_uri", tiktokRedirectUri())
  authorize.searchParams.set("state", state)
  return NextResponse.json({ url: authorize.toString() })
}

export async function DELETE() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { error } = await supabase.from("creator_social_connections").update({
    status: "DISCONNECTED", access_token_ciphertext: "revoked", refresh_token_ciphertext: null,
    updated_at: new Date().toISOString(),
  }).eq("creator_id", creator.id).eq("platform", "TIKTOK")
  if (error) return NextResponse.json({ error: "Could not disconnect TikTok" }, { status: 500 })
  return NextResponse.json({ success: true })
}
