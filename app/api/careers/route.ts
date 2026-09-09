import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { verifyCaptchaToken } from "@/lib/captcha"
import { renderEmailTemplate } from "@/lib/email-templates"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const turnstile = await verifyCaptchaToken(
      formData.get("captchaToken") as string | null,
      request
    )
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    const fullName = formData.get("fullName") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string
    const linkedin = formData.get("linkedin") as string
    const cvFile = formData.get("cv") as File | null

    // Validation
    if (!fullName || !email || !phone || !linkedin || !cvFile) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    if (!linkedin.includes("linkedin.com")) {
      return NextResponse.json({ error: "Invalid LinkedIn URL" }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (cvFile.size > maxSize) {
      return NextResponse.json({ error: "CV file must be under 5MB" }, { status: 400 })
    }

    // Convert file to base64 for email attachment
    const bytes = await cvFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    const tpl = await renderEmailTemplate("career_application", { fullName, email, phone, linkedin })
    const sent = await sendEmail({
      route: "career_application",
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
      attachments: [
        {
          filename: cvFile.name,
          content: base64,
        },
      ],
    })

    if (!sent) {
      console.error("Careers email failed; see email logs for details.")
    }

    return NextResponse.json({ success: true, message: "Application submitted successfully" })
  } catch (err) {
    console.error("Careers API error:", err)
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 })
  }
}
