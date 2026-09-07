import { NextResponse } from "next/server"
import {
  authenticateCustomerByEmail,
  createSupportMagicToken,
  destroyCustomerSupportSession,
} from "@/lib/customer-support-auth"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { checkRateLimit } from "@/lib/rate-limit"

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

const UNIFORM_MESSAGE =
  "If this email is registered for a MartPoint business, we have sent a sign-in link. Please check your inbox."

/* ─── POST: request a magic link ─── */
export async function POST(request: Request) {
  const rate = await checkRateLimit(request, { key: "customer-support-login", max: 5, windowSeconds: 60 })
  if (!rate.allowed) {
    return err("Too many attempts. Please try again later.", 429)
  }

  try {
    const body = await request.json()
    const email = (body.email || "").toString().trim()
    if (!email || !email.includes("@")) {
      // Uniform response — do not reveal whether the email is registered.
      return NextResponse.json({ success: true, message: UNIFORM_MESSAGE })
    }

    const business = await authenticateCustomerByEmail(email)

    if (business) {
      const token = createSupportMagicToken(business)
      const link = `${baseUrl()}/api/support/auth/verify?token=${encodeURIComponent(token)}`
      const tpl = await renderEmailTemplate("support_magic_link", {
        contactName: business.primary_contact_name,
        businessName: business.business_name,
        link,
      })
      const sent = await sendEmail({
        to: business.primary_email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      })

      // In non-production, expose the link so local/dev testing works without Resend.
      if (process.env.NODE_ENV !== "production" && !sent) {
        return NextResponse.json({ success: true, message: UNIFORM_MESSAGE, devLink: link })
      }
    }

    return NextResponse.json({ success: true, message: UNIFORM_MESSAGE })
  } catch {
    return err("Failed to process request")
  }
}

/* ─── DELETE: sign out ─── */
export async function DELETE() {
  await destroyCustomerSupportSession()
  return NextResponse.json({ success: true })
}
