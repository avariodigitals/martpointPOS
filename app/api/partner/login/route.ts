import { NextResponse } from "next/server"
import { authenticatePartner, createPartnerSession } from "@/lib/partner-auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromPartnerSession } from "@/lib/audit"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "partner-login", max: 10, windowSeconds: 300 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 5 minutes." },
      { status: 429 }
    )
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
    }

    const user = await authenticatePartner(email, password)

    if (!user) {
      const ctx = auditContextFromPartnerSession(null, request)
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.PARTNER_USER_LOGIN_FAILED,
        entityType: AUDIT_ENTITIES.PARTNER_USER,
        entityId: null,
        metadata: { email: email.toLowerCase().trim() },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await createPartnerSession(user)

    const ctx = auditContextFromPartnerSession(
      { partnerUserId: user.id, partnerId: user.partnerId, role: user.role, name: user.fullName },
      request
    )
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_USER_LOGIN,
      entityType: AUDIT_ENTITIES.PARTNER_USER,
      entityId: user.id,
      metadata: { partnerId: user.partnerId },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    })
  } catch {
    return NextResponse.json({ error: "Failed to process login" }, { status: 500 })
  }
}
