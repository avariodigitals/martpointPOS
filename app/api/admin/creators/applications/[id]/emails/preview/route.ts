import { resolveProfileSignature } from "@/lib/profile-signature"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { renderCreatorEmail } from "@/lib/creator-email"
import { emailComposerFields } from "@/lib/email-correspondence"

const schema = z.object({ ...emailComposerFields, body: z.string().trim().min(1, "Message is required").max(20000) })

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.application.review")
  if (denied) return denied
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const user = await getUserById(session.userId)
  const signature = (await resolveProfileSignature(user)) || "<p><strong>MartPoint Creator Team</strong></p>"
  return NextResponse.json(await renderCreatorEmail(parsed.data.body, signature, parsed.data.layout, parsed.data.bodyHtml))
}
