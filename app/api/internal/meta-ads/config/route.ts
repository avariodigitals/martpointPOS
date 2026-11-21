import { NextResponse } from "next/server"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { getMetaAdsCredentials } from "@/lib/meta-ads-settings"

export const dynamic = "force-dynamic"

/** Internal PHP Central only. The secret is returned server-to-server and never to a browser or Fleet. */
export async function GET(request: Request) {
  const path = new URL(request.url).pathname
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", "", request.headers.get("x-central-signature") || "", path)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  try {
    const settings = await getMetaAdsCredentials()
    if (!settings.tokenMasterKey) return NextResponse.json({ error: "Central Meta token encryption is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } })
    return NextResponse.json({ success: true, ...settings }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } })
  } catch {
    return NextResponse.json({ error: "Meta credentials are unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
