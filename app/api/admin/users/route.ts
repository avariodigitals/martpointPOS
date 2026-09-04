import { NextResponse } from "next/server"
import { isAdminAuthenticated, getAllUsers, createUser, updateUser, disableUser, enableUser } from "@/lib/admin-auth"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { getSession } from "@/lib/admin-auth"

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
    const { username, password, name, role } = body

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const user = await createUser(username, password, name, role)
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
