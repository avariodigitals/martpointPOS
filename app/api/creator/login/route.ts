import { NextResponse } from "next/server"
import { authenticateCreator, createCreatorSession } from "@/lib/creator-auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "creator-login", max: 10, windowSeconds: 300 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 5 minutes." },
      { status: 429 }
    )
  }

  try {
    const { email, password, captchaToken } = await request.json()

    const captcha = await verifyCaptchaToken(captchaToken ?? null, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error }, { status: 403 })
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 })
    }

    const creator = await authenticateCreator(email, password)

    if (!creator) {
      await recordAudit(auditContextFromCreatorSession(null, request), {
        action: AUDIT_ACTIONS.CREATOR_LOGIN_FAILED,
        entityType: AUDIT_ENTITIES.CREATOR,
        entityId: null,
        metadata: { email: String(email).toLowerCase().trim() },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await createCreatorSession(creator)

    await recordAudit(
      auditContextFromCreatorSession({ creatorId: creator.id, name: creator.fullName }, request),
      {
        action: AUDIT_ACTIONS.CREATOR_LOGIN,
        entityType: AUDIT_ENTITIES.CREATOR,
        entityId: creator.id,
        metadata: { creatorCode: creator.creatorId },
      }
    )

    return NextResponse.json({
      success: true,
      creator: { id: creator.id, fullName: creator.fullName, email: creator.email, creatorId: creator.creatorId },
    })
  } catch {
    return NextResponse.json({ error: "Failed to process login" }, { status: 500 })
  }
}
