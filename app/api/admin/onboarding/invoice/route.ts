import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"

async function guardOnboardingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "onboarding")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { recordId, description, amount, tax, dueDate, message } = body

    if (!recordId || !description || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Missing or invalid invoice fields" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { data: record, error: recordError } = await supabase
      .from("onboarding")
      .select("*")
      .eq("id", recordId)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const total = Math.abs(amount) + (typeof tax === "number" ? Math.abs(tax) : 0)

    const txnId = crypto.randomUUID()
    const transaction = {
      id: txnId,
      type: "income",
      category: "Setup & Implementation",
      subcategory: record.product_interest || "",
      amount: Math.abs(amount),
      tax: typeof tax === "number" ? Math.abs(tax) : undefined,
      description: `${description} — ${record.business_name || record.full_name}`,
      date: now.split("T")[0],
      lead_id: record.lead_id,
      account: "",
      recurring: false,
      frequency: "one-time",
      created_at: now,
      updated_at: now,
    }

    const { error: insertError } = await supabase.from("finance_transactions").insert(transaction)
    if (insertError) {
      console.error("[Invoice Finance Insert Error]", insertError)
      return NextResponse.json({ error: "Failed to record income" }, { status: 500 })
    }

    if (record.email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""
      const formLink = `${baseUrl}/onboarding/${recordId}`.replace(/\/$/, "")
      const invoiceTpl = await renderEmailTemplate("onboarding_invoice", {
        fullName: record.full_name,
        businessName: record.business_name || record.full_name,
        description,
        amount: Math.abs(amount).toLocaleString(),
        tax: (tax ? Math.abs(tax) : 0).toLocaleString(),
        total: total.toLocaleString(),
        dueDate: dueDate || "On receipt",
        formLink,
      })
      const emailText = message ? `${message}${formLink ? `\n\nOnboarding form: ${formLink}` : ""}` : invoiceTpl.text
      const emailHtml = `<div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#0057FF">MartPoint Invoice</h2>
        <p>Hi ${record.full_name},</p>
        <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">${emailText.replace(/\n/g, "<br>")}</div>
        ${formLink ? `<p><a href="${formLink}" style="color:#0057FF">Complete Onboarding Form</a></p>` : ""}
        <p>Best regards,<br>MartPoint Team</p>
      </div>`

      await sendEmail({
        to: record.email,
        subject: invoiceTpl.subject,
        text: emailText,
        html: emailHtml,
      })
    }

    return NextResponse.json({ success: true, transaction })
  } catch {
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 })
  }
}
