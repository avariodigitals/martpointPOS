import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { EMAIL_TEMPLATES } from "@/lib/email-templates"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: template definitions merged with saved admin overrides ─── */
export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let overrides: Record<string, { subject?: string; text?: string }> = {}
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
    overrides = (((data?.data as Record<string, unknown>)?.email as Record<string, unknown>)?.templates as typeof overrides) || {}
  }

  const templates = EMAIL_TEMPLATES.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    variables: t.variables,
    defaultSubject: t.subject,
    defaultText: t.text,
    subject: overrides[t.key]?.subject || t.subject,
    text: overrides[t.key]?.text || t.text,
  }))

  return NextResponse.json({ templates })
}
