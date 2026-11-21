import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getMetaAdsSettingsSummary, saveMetaAdsSettings } from "@/lib/meta-ads-settings"

export const dynamic = "force-dynamic"

async function adminOnly() {
  const auth = await authorizeAdmin("settings")
  if (auth.denied) return { denied: auth.denied, session: null }
  if (auth.session.role !== "Admin") return { denied: NextResponse.json({ error: "Only an Admin can manage Meta credentials." }, { status: 403 }), session: null }
  return { denied: null, session: auth.session }
}

export async function GET() {
  const { denied } = await adminOnly()
  if (denied) return denied
  try {
    return NextResponse.json({ success: true, settings: await getMetaAdsSettingsSummary() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Meta settings are unavailable." }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  const { denied, session } = await adminOnly()
  if (denied || !session) return denied
  try {
    const body = await request.json() as Record<string, unknown>
    const appId = typeof body.appId === "string" ? body.appId.trim() : ""
    const loginConfigId = typeof body.loginConfigId === "string" ? body.loginConfigId.trim() : ""
    const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri.trim() : ""
    const graphVersion = typeof body.graphVersion === "string" ? body.graphVersion.trim() : ""
    const appSecret = typeof body.appSecret === "string" ? body.appSecret.trim() : ""
    if (!/^\d{5,30}$/.test(appId)) return NextResponse.json({ error: "Enter a valid Meta App ID." }, { status: 400 })
    if (!/^\d{5,40}$/.test(loginConfigId)) return NextResponse.json({ error: "Enter a valid Business Login configuration ID." }, { status: 400 })
    try {
      const uri = new URL(redirectUri)
      if (uri.protocol !== "https:" || uri.username || uri.password || uri.search || uri.hash) throw new Error("invalid")
    } catch { return NextResponse.json({ error: "The redirect URI must be a public HTTPS URL without query parameters." }, { status: 400 }) }
    if (!/^v\d+\.\d+$/.test(graphVersion)) return NextResponse.json({ error: "Use a Meta Graph API version such as v27.0." }, { status: 400 })
    if (appSecret.length > 512) return NextResponse.json({ error: "The Meta App Secret is too long." }, { status: 400 })
    await saveMetaAdsSettings({ appId, loginConfigId, redirectUri, graphVersion, appSecret, clearAppSecret: body.clearAppSecret === true, updatedBy: session.userId })
    return NextResponse.json({ success: true, settings: await getMetaAdsSettingsSummary() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Meta settings." }, { status: 400 })
  }
}
