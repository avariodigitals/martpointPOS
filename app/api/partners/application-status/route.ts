import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { PARTNER_TYPE_LABELS, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/partners"

/* ─── Application status lookup ───
 * Requires BOTH reference number AND the email used to apply.
 * Reference alone must NOT reveal an application.
 * Only exposes applicant-facing information — never internal notes/reviewer/risk.
 */

const PROGRESS_STAGES: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "COMPLIANCE_REQUIRED", "DISCOVERY_CALL", "APPROVED_CONDITIONAL", "APPROVED",
  "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE",
]

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { key: "partner-status", max: 10, windowSeconds: 600 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const reference = String(body.reference || "").trim().toUpperCase()
    const email = String(body.email || "").trim().toLowerCase()

    const captcha = await verifyCaptchaToken(body.captchaToken ?? null, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error }, { status: 403 })
    }

    if (!reference || !email) {
      return NextResponse.json({ error: "Reference number and email are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "System not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("partner_applications")
      .select("id, reference_number, requested_partner_type, status, submitted_at, updated_at, email, information_request_message, rejection_message_public")
      .eq("reference_number", reference)
      .single()

    if (error || !data) {
      // Do not reveal whether the reference exists
      return NextResponse.json({ error: "No application found with those details. Check your reference number and email." }, { status: 404 })
    }

    if ((data.email as string).toLowerCase() !== email) {
      // Email mismatch — same generic message (no email enumeration)
      return NextResponse.json({ error: "No application found with those details. Check your reference number and email." }, { status: 404 })
    }

    const status = data.status as ApplicationStatus
    const progressIndex = PROGRESS_STAGES.indexOf(status)
    let agreementSigning: { status: string; email_sent: boolean; token_expires_at: string } | null = null
    if (status === "AGREEMENT_PENDING") {
      const { data: signing } = await supabase
        .from("partner_agreement_signing")
        .select("status, email_sent, token_expires_at")
        .eq("application_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      agreementSigning = signing
    }

    const requiredAction = (() => {
      if (status === "MORE_INFORMATION_REQUIRED" && data.information_request_message) {
        return data.information_request_message as string
      }
      if (status === "REJECTED" && data.rejection_message_public) {
        return data.rejection_message_public as string
      }
      if (status === "AGREEMENT_PENDING" && agreementSigning?.status === "AWAITING_PARTNER" && agreementSigning.email_sent) {
        return `Your agreement was emailed for signature. The secure link expires ${new Date(agreementSigning.token_expires_at).toLocaleDateString("en-NG")}. Check your inbox and spam folder.`
      }
      if (status === "AGREEMENT_PENDING" && agreementSigning?.status === "AWAITING_PARTNER") return "Your agreement is ready, but the signing email could not be delivered. Contact partners@martpoint.com.ng for a secure link."
      if (status === "AGREEMENT_PENDING" && agreementSigning?.status === "EXECUTED") return "Both parties have signed your agreement. A completed copy was emailed to you."
      if (status === "AGREEMENT_PENDING") return "Your partner agreement is being prepared. Contact partners@martpoint.com.ng if it does not arrive."
      if (status === "TRAINING") return "Complete required partner training."
      if (status === "CERTIFICATION_PENDING") return "Complete certification requirements."
      if (status === "ACTIVE") return "Your partnership is active. Welcome!"
      return null
    })()

    return NextResponse.json({
      application: {
        reference: data.reference_number,
        partnerType: PARTNER_TYPE_LABELS[data.requested_partner_type as keyof typeof PARTNER_TYPE_LABELS] || data.requested_partner_type,
        status,
        statusLabel: APPLICATION_STATUS_LABELS[status] || status,
        submittedAt: data.submitted_at,
        updatedAt: data.updated_at,
        requiredAction,
        rejected: status === "REJECTED",
        active: status === "ACTIVE",
      },
      progress: PROGRESS_STAGES.map((s, i) => ({
        label: APPLICATION_STATUS_LABELS[s],
        reached: progressIndex >= 0 && i <= progressIndex,
      })),
    })
  } catch {
    return NextResponse.json({ error: "Failed to look up application" }, { status: 500 })
  }
}
