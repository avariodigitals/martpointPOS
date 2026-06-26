import { NextResponse } from "next/server"
import { isAdminAuthenticated, getAllUsers, createUser, updateUser, deleteUser } from "@/lib/admin-auth"

/* ─── GET ─── */
export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = getAllUsers().map(({ passwordHash, ...u }) => u)
  return NextResponse.json({ users })
}

/* ─── POST (create) ─── */
export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { username, password, name, role } = body

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const user = createUser(username, password, name, role)
    const { passwordHash: _, ...safe } = user
    return NextResponse.json({ success: true, user: safe })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── PUT (update) ─── */
export async function PUT(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const user = updateUser(id, updates)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const { passwordHash: _, ...safe } = user
    return NextResponse.json({ success: true, user: safe })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── DELETE ─── */
export async function DELETE(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const success = deleteUser(id)
    if (!success) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
