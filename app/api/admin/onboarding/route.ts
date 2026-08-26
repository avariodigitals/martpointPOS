import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { generateSetupQuestions } from "@/lib/onboarding"

/* ─── Types ─── */
interface OnboardingRecord {
  id: string
  leadId: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  status: "Pending" | "In Progress" | "Completed" | "Rejected"
  setupQuestionsSent: boolean
  clientResponses: Record<string, unknown>
  documents: Array<{ name: string; url: string; uploadedAt: string }>
  signatureUrl: string
  notes: string
  createdAt: string
  updatedAt: string
}

/* ─── Auth guard ─── */
async function guardOnboardingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "onboarding")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: list onboarding records ─── */
export async function GET() {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ records: [] })
  }

  try {
    const { data, error } = await supabase
      .from("onboarding")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Supabase Onboarding GET Error]", error)
      return NextResponse.json({ error: "Failed to fetch onboarding records" }, { status: 500 })
    }

    const records = (data || []).map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      fullName: row.full_name,
      businessName: row.business_name,
      email: row.email,
      phone: row.phone,
      productInterest: row.product_interest,
      status: row.status,
      setupQuestionsSent: row.setup_questions_sent,
      clientResponses: row.client_responses || {},
      documents: row.documents || [],
      signatureUrl: row.signature_url || "",
      notes: row.notes || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ records })
  } catch {
    return NextResponse.json({ error: "Failed to fetch onboarding records" }, { status: 500 })
  }
}

/* ─── POST: create onboarding record & send questions ─── */
export async function POST(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { leadId, fullName, businessName, email, phone, productInterest, message } = body

    if (!leadId || !fullName || !email || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const recordId = crypto.randomUUID()
    const now = new Date().toISOString()

    const record: OnboardingRecord = {
      id: recordId,
      leadId,
      fullName,
      businessName: businessName || "",
      email,
      phone,
      productInterest: productInterest || "retail",
      status: "Pending",
      setupQuestionsSent: true,
      clientResponses: {},
      documents: [],
      signatureUrl: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
    }

    // Save to Supabase
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from("onboarding").insert({
        id: recordId,
        lead_id: leadId,
        full_name: fullName,
        business_name: businessName || "",
        email,
        phone,
        product_interest: productInterest || "retail",
        status: "Pending",
        setup_questions_sent: true,
        client_responses: {},
        documents: [],
        signature_url: "",
        notes: "",
        created_at: now,
        updated_at: now,
      })
      if (error) {
        console.error("[Supabase Onboarding Insert Error]", error)
        return NextResponse.json({ error: "Failed to create onboarding record" }, { status: 500 })
      }
    }

    // Send email with setup questions
    const resendKey = process.env.RESEND_API_KEY
    const notifyEmail = process.env.NOTIFY_EMAIL || email
    const setupQuestions = generateSetupQuestions(productInterest || "retail")
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""
    const formLink = `${baseUrl}/onboarding/${recordId}`.replace(/\/$/, "")

    const defaultEmailText = `Hi ${fullName},\n\nWelcome to MartPoint! To get your system up and running, we need a few critical details.\n\n${setupQuestions}\n\nBest regards,\nMartPoint Team`
    const emailText = (message || defaultEmailText) + `\n\nComplete your onboarding form:\n${formLink}`
    const emailHtml = `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#0057FF">Welcome to MartPoint</h2>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">${emailText.replace(/\n/g, "<br>")}</div>
      <p><a href="${formLink}" style="color:#0057FF">Complete Onboarding Form</a></p>
      <p>Best regards,<br>MartPoint Team</p>
    </div>`

    if (resendKey && notifyEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "MartPoint Onboarding <onboarding@martpoint.com.ng>",
            to: email,
            subject: `Welcome to MartPoint — Action Required: Setup Your Account`,
            text: emailText,
            html: emailHtml,
          }),
        })
      } catch (err) {
        console.error("Onboarding email failed:", err)
      }
    }

    // WhatsApp notification (if configured)
    const waPhoneId = process.env.WHATSAPP_PHONE_ID
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN
    if (waPhoneId && waToken && phone) {
      try {
        const cleanPhone = phone.replace(/\D/g, "")
        if (cleanPhone.length >= 10) {
          await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: `+${cleanPhone}`,
              type: "text",
              text: {
                body: `Welcome to MartPoint, ${fullName}!\n\nTo set up your system, we need a few details:\n\n${setupQuestions}\n\nPlease reply here or check your email for the full onboarding form.`,
              },
            }),
          })
        }
      } catch (err) {
        console.error("WhatsApp onboarding notification failed:", err)
      }
    }

    return NextResponse.json({ success: true, record })
  } catch {
    return NextResponse.json({ error: "Failed to initiate onboarding" }, { status: 500 })
  }
}

/* ─── PUT: update onboarding record ─── */
export async function PUT(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, status, notes, clientResponses, documents, signatureUrl } = body

    if (!id) {
      return NextResponse.json({ error: "Onboarding ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (clientResponses !== undefined) updateData.client_responses = clientResponses
    if (documents !== undefined) updateData.documents = documents
    if (signatureUrl !== undefined) updateData.signature_url = signatureUrl

    const { data, error } = await supabase
      .from("onboarding")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      console.error("[Supabase Onboarding Update Error]", error)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, record: data })
  } catch {
    return NextResponse.json({ error: "Failed to update onboarding" }, { status: 500 })
  }
}

/* ─── DELETE ─── */
export async function DELETE(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Onboarding ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { error } = await supabase.from("onboarding").delete().eq("id", id)

    if (error) {
      console.error("[Supabase Onboarding Delete Error]", error)
      return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete onboarding record" }, { status: 500 })
  }
}


