import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession, getUserById, updateUser } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { htmlToText } from "@/lib/email-html"
import { renderSignatureTemplate } from "@/lib/email-signature"
import { getProfileSignatureTemplate } from "@/lib/profile-signature"

const templateSchema = z.object({
  name: z.string().trim().min(1).max(200), title: z.string().trim().max(200),
  email: z.union([z.email(), z.literal("")]), phone: z.string().trim().max(60),
  company: z.string().trim().max(200), extra: z.string().max(2000),
}).strict()
const schema = z.union([
  z.object({ template: templateSchema, profilePhone: z.string().trim().max(60) }).strict(),
  z.object({ signatureHtml: z.string().max(20000, "Signature is too long") }).strict(),
])

/** Every signed-in staff member can update only their own signature. */
export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Please sign in again" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const user = await getUserById(session.userId)
    if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Account is unavailable" }, { status: 403 })
    const templateInput = "template" in parsed.data ? parsed.data : null
    const template = templateInput
      ? await getProfileSignatureTemplate({ ...user, signatureTemplate: templateInput.template })
      : null
    const safeHtml = sanitizeSupportHtml(template ? renderSignatureTemplate(template) : (parsed.data as { signatureHtml: string }).signatureHtml).trim()
    const signatureHtml = htmlToText(safeHtml).trim() || /<img\b/i.test(safeHtml) ? safeHtml : ""
    const updated = await updateUser(session.userId, {
      signatureHtml,
      ...(templateInput ? { signatureTemplate: template, phone: templateInput.profilePhone } : {}),
    })
    if (!updated) return NextResponse.json({ error: "Could not save your signature. Please retry." }, { status: 500 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: session.userId,
      metadata: { field: "signature_html", selfService: true },
    })
    return NextResponse.json({ success: true, signatureHtml: updated.signatureHtml, template })
  } catch (error) {
    console.error("[profile signature]", error)
    return NextResponse.json({ error: "Could not save your signature. Please retry." }, { status: 500 })
  }
}
