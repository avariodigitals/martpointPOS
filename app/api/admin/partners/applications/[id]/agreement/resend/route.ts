import crypto from "crypto"
import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/partner-documents"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/email-html"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (session?.role !== "Admin") return NextResponse.json({ error: "Only an Admin can resend an agreement for signature" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const { id: applicationId } = await params
  const { data: app, error: appError } = await supabase
    .from("partner_applications")
    .select("id, full_name, business_name, email")
    .eq("id", applicationId)
    .maybeSingle()
  if (appError || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const { data: signing, error: signingError } = await supabase
    .from("partner_agreement_signing")
    .select("id, agreement_id, source_document_id, token_expires_at, status")
    .eq("application_id", applicationId)
    .eq("status", "AWAITING_PARTNER")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (signingError || !signing) return NextResponse.json({ error: "There is no unsigned agreement to resend. Generate and review a new draft first." }, { status: 409 })
  if (new Date(signing.token_expires_at as string) <= new Date()) {
    await supabase.from("partner_agreement_signing").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", signing.id).eq("status", "AWAITING_PARTNER")
    return NextResponse.json({ error: "This signing request has expired. Generate and review a new agreement draft before sending again." }, { status: 410 })
  }
  if (!signing.source_document_id) return NextResponse.json({ error: "The agreement file is unavailable. Generate a reviewed replacement draft." }, { status: 409 })

  const { data: document } = await supabase
    .from("partner_documents")
    .select("storage_path, original_filename")
    .eq("id", signing.source_document_id)
    .eq("application_id", applicationId)
    .maybeSingle()
  if (!document?.storage_path) return NextResponse.json({ error: "The agreement PDF could not be found" }, { status: 404 })

  const { data: pdfBlob, error: downloadError } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).download(document.storage_path as string)
  if (downloadError || !pdfBlob) return NextResponse.json({ error: "Could not retrieve the agreement PDF for email" }, { status: 500 })
  const pdf = Buffer.from(await pdfBlob.arrayBuffer())
  if (pdf.length > 7 * 1024 * 1024) return NextResponse.json({ error: "The agreement PDF is too large to attach. Contact support to send it securely." }, { status: 413 })

  const recipient = String(app.email || "").trim().toLowerCase()
  if (!recipient) return NextResponse.json({ error: "The applicant email is missing" }, { status: 409 })

  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data: rotated, error: rotateError } = await supabase.from("partner_agreement_signing")
    .update({ token_hash: tokenHash, token_expires_at: expiresAt, email_sent: false, email_sent_at: null, updated_at: now })
    .eq("id", signing.id)
    .eq("status", "AWAITING_PARTNER")
    .gt("token_expires_at", now)
    .select("id")
    .maybeSingle()
  if (rotateError || !rotated) return NextResponse.json({ error: "The signing request changed while resending. Refresh and check its current status." }, { status: 409 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
  const signingUrl = `${baseUrl}/partners/sign-agreement?token=${encodeURIComponent(token)}`
  const partnerName = String(app.full_name || app.business_name || "Partner")
  const fileName = String(document.original_filename || `Partner-Agreement-${signing.agreement_id}.pdf`)
  const emailSent = await sendEmail({
    to: recipient,
    subject: `Partner Agreement ${String(signing.agreement_id)} — review and sign`,
    text: `Hello ${partnerName},\n\nHere is your MartPoint Partner Agreement ${String(signing.agreement_id)} again. The reviewed PDF is attached. MartPoint has signed electronically. Please use this refreshed secure link to review and sign within 14 days:\n\n${signingUrl}\n\nYour previous signing link has been replaced. If you have questions, reply to this email or contact partners@martpoint.com.ng.`,
    html: `<p>Hello ${escapeHtml(partnerName)},</p><p>Here is your MartPoint Partner Agreement <strong>${escapeHtml(String(signing.agreement_id))}</strong> again. The reviewed PDF is attached, and MartPoint has signed electronically. Please review and sign using this refreshed secure link within 14 days.</p><p><a href="${escapeHtml(signingUrl)}" style="display:inline-block;background:#0057ff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px">Review and sign agreement</a></p><p>Your previous signing link has been replaced. If you have questions, reply to this email or contact partners@martpoint.com.ng.</p>`,
    attachments: [{ filename: fileName, content: pdf.toString("base64") }],
    route: "partner_application",
    useRouteRecipients: false,
    replyTo: "partners@martpoint.com.ng",
  })
  await supabase.from("partner_agreement_signing").update({ email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", signing.id).eq("token_hash", tokenHash)
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.PARTNER_AGREEMENT_GENERATED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: applicationId,
    metadata: { agreementId: String(signing.agreement_id), event: "SIGNING_EMAIL_RESENT", emailSent },
  }).catch((error) => console.error("[agreement resend] audit record failed:", error))

  return NextResponse.json({ success: true, agreementId: signing.agreement_id, emailSent, signingUrl: emailSent ? null : signingUrl, expiresAt, fileName })
}
