import crypto from "crypto"
import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { encryptSocialToken, tiktokConfigured, tiktokRedirectUri } from "@/lib/creator-social-metrics"

export const dynamic = "force-dynamic"

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string; error?: string; error_description?: string }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = url.searchParams.get("state") || ""
  const code = url.searchParams.get("code") || ""
  const fail = (reason: string) => NextResponse.redirect(new URL(`/creator/profile?social=${encodeURIComponent(reason)}`, url.origin))
  if (url.searchParams.has("error")) return fail("denied")
  const { creator, denied } = await authorizeCreator()
  if (denied) return NextResponse.redirect(new URL("/creator/login", url.origin))
  if (!state || !code || !tiktokConfigured() || !process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) return fail("setup")

  const stateHash = crypto.createHash("sha256").update(state).digest("hex")
  const { data: stateRow, error: stateReadError } = await supabase.from("creator_social_oauth_states")
    .select("state_hash, creator_id, expires_at").eq("state_hash", stateHash).eq("creator_id", creator.id).eq("platform", "TIKTOK").maybeSingle()
  if (stateReadError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) return fail("state")
  const { data: consumed, error: consumedError } = await supabase.from("creator_social_oauth_states").delete()
    .eq("state_hash", stateHash).eq("creator_id", creator.id).select("state_hash")
  if (consumedError || !consumed?.length) return fail("state")

  const form = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(),
  })
  const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" })
  const token = await tokenResponse.json() as TokenResponse
  if (!tokenResponse.ok || !token.access_token || !token.refresh_token || !token.open_id) {
    console.error("[creator-social] TikTok authorization exchange failed", token.error || token.error_description || tokenResponse.status)
    return fail("authorization")
  }

  const infoUrl = new URL("https://open.tiktokapis.com/v2/user/info/")
  infoUrl.searchParams.set("fields", "open_id,display_name,username,profile_deep_link")
  const infoResponse = await fetch(infoUrl, { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" })
  const info = await infoResponse.json() as { data?: { user?: { open_id?: string; display_name?: string; username?: string; profile_deep_link?: string } }; error?: { message?: string } }
  if (!infoResponse.ok || !info.data?.user?.open_id || info.data.user.open_id !== token.open_id) {
    console.error("[creator-social] TikTok profile verification failed", info.error?.message || infoResponse.status)
    return fail("profile")
  }

  const user = info.data.user
  const { error: saveError } = await supabase.from("creator_social_connections").upsert({
    creator_id: creator.id,
    platform: "TIKTOK",
    platform_user_id: user.open_id,
    display_name: user.display_name || null,
    username: user.username || null,
    access_token_ciphertext: encryptSocialToken(token.access_token),
    refresh_token_ciphertext: encryptSocialToken(token.refresh_token),
    access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(),
    refresh_token_expires_at: new Date(Date.now() + Number(token.refresh_expires_in || 0) * 1000).toISOString(),
    scopes: (token.scope || "").split(",").filter(Boolean),
    status: "CONNECTED",
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_sync_error: null,
  }, { onConflict: "creator_id,platform" })
  if (saveError) {
    console.error("[creator-social] TikTok connection save failed", saveError.message)
    return fail("save")
  }
  return NextResponse.redirect(new URL("/creator/profile?social=connected", url.origin))
}
