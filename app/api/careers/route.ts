import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

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

    const resendKey = process.env.RESEND_API_KEY
    const notifyEmail = process.env.NOTIFY_EMAIL || "careers@martpoint.com.ng"

    if (resendKey && notifyEmail) {
      const body = {
        from: "MartPoint Careers <careers@martpoint.com.ng>",
        to: notifyEmail,
        subject: `New Career Application: ${fullName}`,
        text: `New career application received.

Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
LinkedIn: ${linkedin}

Reply to this candidate at ${email}.`,
        html: `<div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#0057FF">New Career Application</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:bold">Full Name</td><td style="padding:8px 0;border-bottom:1px solid #eee">${fullName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:bold">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:bold">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee">${phone}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:bold">LinkedIn</td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${linkedin}" target="_blank">${linkedin}</a></td></tr>
          </table>
          <p style="margin-top:20px;color:#666">CV attached below.</p>
        </div>`,
        attachments: [
          {
            filename: cvFile.name,
            content: base64,
          },
        ],
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown Resend error")
        console.error("Resend careers email failed:", errText)
        return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 502 })
      }
    } else {
      console.log("Careers application (email not configured):", { fullName, email, phone, linkedin, cvName: cvFile.name })
    }

    return NextResponse.json({ success: true, message: "Application submitted successfully" })
  } catch (err) {
    console.error("Careers API error:", err)
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 })
  }
}
