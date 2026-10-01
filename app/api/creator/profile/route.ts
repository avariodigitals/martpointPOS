import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"

const schema = z.object({
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
})

export async function PATCH(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = schema.parse(await request.json())
    const { error } = await supabase
      .from("creators")
      .update({
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
        state: body.state || null,
        city: body.city || null,
        bio: body.bio || null,
      })
      .eq("id", creator.id)
    if (error) {
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
    }
    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR,
      entityId: creator.id,
      metadata: { fields: Object.keys(body) },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
