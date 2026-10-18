import { NextResponse } from "next/server"
import { isAdminAuthenticated, getAllUsers, createAdminInvitation, updateUser, disableUser, enableUser } from "@/lib/admin-auth"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { getSession } from "@/lib/admin-auth"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/email-html"

/* ─── GET ─── */
export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = (await getAllUsers()).map(({ passwordHash, ...u }) => u)
  return NextResponse.json({ users })
}

/* ─── POST (create) ─── */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { username, email, name, role, signatureHtml } = body

    if (!username || !name || !role || !email) {
      return NextResponse.json({ error: "Username, email, name and role are required" }, { status: 400 })
    }

    const invitation = await createAdminInvitation(username, email, name, role)
    const origin = new URL(request.url).origin
    const inviteUrl = `${origin}/admin/invite/${encodeURIComponent(invitation.token)}`
    const emailSent = await sendEmail({
      to: invitation.user.email,
      subject: "Your MartPoint Admin invitation",
      text: `Hello ${invitation.user.name},\n\nYou have been invited to MartPoint Admin as ${invitation.user.role}.\n\nUsername: ${invitation.user.username}\n\nSet your password and activate your account here:\n${inviteUrl}\n\nThis link expires in 48 hours.`,
      html: `<p>Hello ${escapeHtml(invitation.user.name)},</p><p>You have been invited to MartPoint Admin as <strong>${escapeHtml(invitation.user.role)}</strong>.</p><p><strong>Username:</strong> ${escapeHtml(invitation.user.username)}</p><p><a href="${inviteUrl}">Set your password and activate your account</a></p><p>This link expires in 48 hours.</p>`,
    })
    if (!emailSent) {
      return NextResponse.json({ error: "User was created, but the invitation email could not be sent." }, { status: 502 })
    }
    const user = await updateUser(invitation.user.id, { signatureHtml: signatureHtml || "" })
    if (!user) return NextResponse.json({ error: "User was created, but could not be loaded." }, { status: 500 })
    const { passwordHash: _, ...safe } = user

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.ADMIN_USER_CREATED,
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: user.id,
      metadata: { username: user.username, role: user.role },
    })

    return NextResponse.json({ success: true, user: safe })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── PUT (update) ─── */
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const previous = await getAllUsers().then((users) => users.find((u) => u.id === id))
    const user = await updateUser(id, updates)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const { passwordHash: _, ...safe } = user

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: id,
      metadata: { previousRole: previous?.role, newRole: user.role, updatedFields: Object.keys(updates) },
    })

    return NextResponse.json({ success: true, user: safe })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── PATCH (disable / enable) ─── */
export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status || !["ACTIVE", "DISABLED"].includes(status)) {
      return NextResponse.json({ error: "User ID and valid status are required" }, { status: 400 })
    }

    const ok = status === "ACTIVE" ? await enableUser(id) : await disableUser(id)
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action:
        status === "ACTIVE"
          ? AUDIT_ACTIONS.ADMIN_USER_UPDATED
          : AUDIT_ACTIONS.ADMIN_USER_DISABLED,
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: id,
      metadata: { status },
    })

    return NextResponse.json({ success: true, status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── DELETE (soft disable) ─── */
export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const success = await disableUser(id)
    if (!success) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.ADMIN_USER_DISABLED,
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: id,
      metadata: {},
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to disable user" }, { status: 500 })
  }
}
