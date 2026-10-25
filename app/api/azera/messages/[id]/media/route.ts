import { getSession, hasPermission } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"
import { NextResponse } from "next/server"
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const { id } = await params
    const { data: message } = await supabase
      .from("azera_messages")
      .select("conversation_id,metadata")
      .eq("id", id)
      .maybeSingle()
    const mediaId = message?.metadata?.provider_media_id
    if (typeof mediaId !== "string" || !/^\d+$/.test(mediaId))
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      )
    const { data: conversation } = await supabase
      .from("azera_conversations")
      .select("business_id,channel")
      .eq("id", message!.conversation_id)
      .maybeSingle()
    if (conversation?.channel !== "whatsapp")
      return NextResponse.json(
        { error: "Unsupported attachment" },
        { status: 400 }
      )
    const { data: config } = await supabase
      .from("azera_settings")
      .select("whatsapp_access_token")
      .eq("business_id", conversation.business_id)
      .maybeSingle()
    const token =
      config?.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN
    const settings = await getSettings()
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : { "D360-API-KEY": settings.whatsapp.apiKey }
    if (!token && !settings.whatsapp.apiKey)
      throw new Error("Missing media provider")
    const base = token
      ? `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`
      : settings.whatsapp.baseUrl.replace(/\/$/, "")
    const parsed = new URL(base)
    if (
      parsed.protocol !== "https:" ||
      !/(^|\.)(facebook\.com|360dialog\.(io|com))$/.test(parsed.hostname)
    )
      throw new Error("Invalid provider")
    const info = await fetch(`${base}/${mediaId}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    })
    if (!info.ok) throw new Error("Media lookup failed")
    const asset = await info.json(),
      url = new URL(asset.url)
    if (
      url.protocol !== "https:" ||
      !/(^|\.)(facebook\.com|fbcdn\.net|fbsbx\.com|360dialog\.(io|com))$/.test(
        url.hostname
      )
    )
      throw new Error("Invalid media location")
    if (Number(asset.file_size) > 4 * 1024 * 1024)
      throw new Error("Attachment too large")
    const response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok || !response.body)
      throw new Error("Could not read attachment")
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 4 * 1024 * 1024) {
        await reader.cancel()
        throw new Error("Attachment too large")
      }
      chunks.push(value)
    }
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="customer-attachment"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not download this attachment. Check the provider connection or open it in the provider inbox.",
      },
      { status: 502 }
    )
  }
}
