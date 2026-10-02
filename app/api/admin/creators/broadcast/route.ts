import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { pushCreatorNotification, sendCreatorNotification } from "@/lib/creator-notifications"

export const dynamic = "force-dynamic"

const SITE_URL = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")

const schema = z.object({
  audience: z.enum(["ALL", "READY", "CHALLENGE", "SELECTED"]),
  challengeId: z.string().uuid().optional(),
  creatorIds: z.array(z.string().uuid()).optional(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(2000),
  link: z.string().trim().max(500).optional(),
  sendEmail: z.boolean().optional(),
})

async function resolveRecipients(
  audience: "ALL" | "READY" | "CHALLENGE" | "SELECTED",
  creatorIds: string[] | undefined,
  challengeId: string | undefined
): Promise<{ id: string; email: string; full_name: string }[]> {
  if (audience === "SELECTED") {
    if (!creatorIds?.length) return []
    const { data } = await supabase
      .from("creators")
      .select("id, email, full_name")
      .in("id", creatorIds)
      .neq("status", "REMOVED")
    return (data || []) as { id: string; email: string; full_name: string }[]
  }

  if (audience === "CHALLENGE") {
    if (!challengeId) return []
    const { data: parts } = await supabase
      .from("creator_challenge_participants")
      .select("creator_id")
      .eq("challenge_id", challengeId)
    const ids = (parts || []).map((p) => p.creator_id as string)
    if (!ids.length) return []
    const { data } = await supabase
      .from("creators")
      .select("id, email, full_name")
      .in("id", ids)
      .neq("status", "REMOVED")
    return (data || []) as { id: string; email: string; full_name: string }[]
  }

  if (audience === "READY") {
    const { data: ready } = await supabase
      .from("creator_onboarding")
      .select("creator_id")
      .not("ready_at", "is", null)
    const ids = (ready || []).map((r) => r.creator_id as string)
    if (!ids.length) return []
    const { data } = await supabase
      .from("creators")
      .select("id, email, full_name")
      .in("id", ids)
      .neq("status", "REMOVED")
    return (data || []) as { id: string; email: string; full_name: string }[]
  }

  const { data } = await supabase
    .from("creators")
    .select("id, email, full_name")
    .neq("status", "REMOVED")
  return (data || []) as { id: string; email: string; full_name: string }[]
}

/** Audience metadata for the broadcast composer. */
export async function GET() {
  const { denied } = await authorizeAdmin("creator.notifications.send")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ totalCreators: 0, readyCreators: 0, challenges: [] })
  }

  const [{ count: totalCreators }, { data: ready }, { data: challenges }] = await Promise.all([
    supabase.from("creators").select("id", { count: "exact", head: true }).neq("status", "REMOVED"),
    supabase.from("creator_onboarding").select("creator_id").not("ready_at", "is", null),
    supabase.from("creator_challenges").select("id, title, status").order("created_at", { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    totalCreators: totalCreators || 0,
    readyCreators: (ready || []).length,
    challenges: (challenges || []).map((c) => ({ id: c.id, title: c.title, status: c.status })),
  })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.notifications.send")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = schema.parse(await request.json())
    const recipients = await resolveRecipients(body.audience, body.creatorIds, body.challengeId)
    if (!recipients.length) {
      return NextResponse.json({ error: "No creators match that audience" }, { status: 400 })
    }

    const linkUrl = body.link
      ? body.link.startsWith("http") ? body.link : `${SITE_URL()}${body.link}`
      : `${SITE_URL()}/creator`

    let emailsSent = 0
    for (const c of recipients) {
      await pushCreatorNotification({
        creatorId: c.id,
        type: "ANNOUNCEMENT",
        title: body.title,
        body: body.body,
        link: body.link || "/creator",
      })
      if (body.sendEmail && c.email) {
        const sent = await sendCreatorNotification({
          template: "creator_announcement",
          to: c.email,
          creatorId: c.id,
          vars: {
            fullName: c.full_name,
            title: body.title,
            body: body.body,
            linkUrl,
            portalUrl: `${SITE_URL()}/creator`,
          },
        })
        if (sent) emailsSent++
      }
    }

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_BROADCAST_SENT,
      entityType: "creator",
      metadata: {
        audience: body.audience,
        challengeId: body.challengeId,
        recipientCount: recipients.length,
        emailsSent,
        title: body.title,
      },
    })

    return NextResponse.json({ success: true, recipients: recipients.length, emailsSent })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 })
  }
}
