import { NextResponse } from "next/server"
import { consumeCreatorAuthToken, createCreatorSession } from "@/lib/creator-auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "creator-password-set", max: 10, windowSeconds: 600 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  try {
    const { token, type, password } = await request.json()
    const tokenType = type === "RESET_PASSWORD" ? "RESET_PASSWORD" : "SET_PASSWORD"

    if (!token || typeof password !== "string" || password.length < 10) {
      return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 })
    }

    const result = await consumeCreatorAuthToken(String(token), tokenType, password)
    if (!result.ok || !result.creator) {
      return NextResponse.json({ error: result.error || "Invalid or expired link" }, { status: 400 })
    }

    await createCreatorSession(result.creator)
    await recordAudit(
      auditContextFromCreatorSession({ creatorId: result.creator.id, name: result.creator.fullName }, request),
      {
        action: AUDIT_ACTIONS.CREATOR_PASSWORD_SET,
        entityType: AUDIT_ENTITIES.CREATOR,
        entityId: result.creator.id,
        metadata: { via: tokenType },
      }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 })
  }
}
