import { NextResponse } from "next/server"
import { authenticateUser, setSessionCookie } from "@/lib/admin-auth"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const limit = checkRateLimit(request, { key: "admin-login", max: 10, windowSeconds: 300 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 5 minutes." },
      { status: 429 }
    )
  }

  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const session = await authenticateUser(username, password)

    if (!session) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    await setSessionCookie(session)

    return NextResponse.json({ success: true, user: { username: session.username, role: session.role, name: session.name } })
  } catch {
    return NextResponse.json({ error: "Failed to process login" }, { status: 500 })
  }
}
