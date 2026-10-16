import { NextResponse } from "next/server"
import { enrolInstall } from "@/lib/install-enrolment"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return NextResponse.json({ ok: false }, { status: 413 })
    const text = await request.text()
    if (text.length > 4096) return NextResponse.json({ ok: false }, { status: 413 })
    const body = JSON.parse(text)
    if (typeof body.install_url !== "string" || typeof body.install_key !== "string") return NextResponse.json({ ok: false })
    const token = await enrolInstall(body.install_url, body.install_key)
    return NextResponse.json(token ? { ok: true, token } : { ok: false }, { headers: { "Cache-Control": "no-store" } })
  } catch { return NextResponse.json({ ok: false }, { headers: { "Cache-Control": "no-store" } }) }
}
