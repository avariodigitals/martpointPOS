import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { centralSignature } from "@/lib/central-billing-auth"

export async function GET() {
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied

  const centralUrl = process.env.CENTRAL_BILLING_CENTRAL_URL || ""
  if (!centralUrl.startsWith("https://")) return NextResponse.json({ error: "Central installation directory is not configured" }, { status: 503 })

  const body = JSON.stringify({ purpose: "admin_installation_picker" })
  const path = "/messaging_api/installation_directory"
  const timestamp = Math.floor(Date.now() / 1000).toString()
  try {
    const response = await fetch(`${centralUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-central-timestamp": timestamp,
        "x-central-signature": centralSignature(timestamp, body, path),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    const result = await response.json().catch(() => null) as { success?: boolean; installations?: Array<{ id: number; install_url: string; last_seen: string | null; created_at: string | null }>; message?: string } | null
    if (!response.ok || !result?.success || !Array.isArray(result.installations)) {
      return NextResponse.json({ error: result?.message || "Central could not return its registered installations" }, { status: 503 })
    }
    return NextResponse.json({ installations: result.installations })
  } catch (error) {
    console.error("[central installation directory]", error)
    return NextResponse.json({ error: "Central installation directory could not be reached" }, { status: 503 })
  }
}
