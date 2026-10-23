import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, canPartnerAccessBusiness } from "@/lib/partner-auth"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromPartnerSession } from "@/lib/audit"
import { recordPayment } from "@/lib/finance-commercial"
import { PARTNER_DOCUMENTS_BUCKET, uploadPrivateFile, validatePartnerFile } from "@/lib/partner-documents"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export const dynamic = "force-dynamic"

export async function POST(request: Request, props: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await props.params
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "payments:submit_proof" })
  if (!auth.authorized) return auth.response!
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const access = await canPartnerAccessBusiness(session!.partnerId, businessId, {
    partnerUserId: auth.user!.id,
    userPermission: "customers:view_assigned",
  })
  if (!access.allowed) return NextResponse.json({ error: "Customer access denied" }, { status: 403 })

  const form = await request.formData()
  const invoiceId = String(form.get("invoiceId") || "")
  const amount = Number(form.get("amount"))
  const gatewayReference = String(form.get("gatewayReference") || "").trim()
  const notes = String(form.get("notes") || "").trim()
  const file = form.get("proof")
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0 || !(file instanceof File)) {
    return NextResponse.json({ error: "Invoice, amount and proof document are required" }, { status: 400 })
  }

  const validation = validatePartnerFile({ type: file.type, size: file.size })
  if (validation) return NextResponse.json({ error: validation }, { status: 400 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, business_id, status, balance_due, currency")
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .maybeSingle()
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(String(invoice.status))) {
    return NextResponse.json({ error: "This invoice is not open for payment" }, { status: 400 })
  }
  const { data: pendingPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("status", "PENDING")
  const pendingTotal = (pendingPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  if (amount + pendingTotal > Number(invoice.balance_due || 0)) {
    return NextResponse.json({ error: "Payment amount exceeds the invoice balance" }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const storagePath = `payment-proofs/${businessId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const upload = await uploadPrivateFile(PARTNER_DOCUMENTS_BUCKET, storagePath, file.name, file.type, bytes)
  if (!upload.ok) return NextResponse.json({ error: upload.error || "Proof upload failed" }, { status: 500 })

  try {
    const payment = await recordPayment({
      business_id: businessId,
      invoice_id: invoiceId,
      amount,
      currency: invoice.currency as string,
      payment_method: "BANK_TRANSFER",
      gateway_reference: gatewayReference || undefined,
      notes: notes || undefined,
    })
    const { error } = await supabase.from("payments").update({ proof_document_path: storagePath, updated_at: new Date().toISOString() }).eq("id", payment.id)
    if (error) return NextResponse.json({ error: "Payment recorded but proof could not be attached" }, { status: 500 })

    await recordAudit(auditContextFromPartnerSession(session, request), {
      action: AUDIT_ACTIONS.PARTNER_PAYMENT_PROOF_SUBMITTED,
      entityType: AUDIT_ENTITIES.PARTNER_PAYMENT,
      entityId: payment.id,
      metadata: { partnerId: session!.partnerId, businessId, invoiceId, amount, paymentReference: payment.payment_reference },
    })
    await notifyAllAdmins({
      type: "PARTNER_PAYMENT_PROOF_SUBMITTED",
      title: "Partner payment proof submitted",
      message: `${payment.payment_reference}: ${invoiceId} · ${amount.toLocaleString()} ${invoice.currency}`,
      deep_link: `/admin/finance/transactions?businessId=${encodeURIComponent(businessId)}`,
      source_type: "payment",
      source_id: payment.id as string,
      roles: ["Admin", "Finance", "Sales", "Customer Care"],
      email: {
        route: "payment_proof_submitted",
        subject: `Payment proof requires review — ${payment.payment_reference}`,
        text: [
          "A partner submitted payment proof for review.",
          `Payment reference: ${payment.payment_reference}`,
          `Business: ${businessId}`,
          `Invoice: ${invoiceId}`,
          `Amount: ${amount.toLocaleString()} ${invoice.currency}`,
          "Open Finance → Transactions in the Admin Portal.",
        ].join("\n"),
      },
    })
    return NextResponse.json({ success: true, payment: { id: payment.id, reference: payment.payment_reference, status: payment.status } })
  } catch (error) {
    console.error("[partner/payments] record failed", error)
    return NextResponse.json({ error: "Could not submit payment proof" }, { status: 500 })
  }
}
