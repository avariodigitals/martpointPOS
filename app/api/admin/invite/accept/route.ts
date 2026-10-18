import { NextResponse } from "next/server"
import { acceptAdminInvitation } from "@/lib/admin-auth"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()
    if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "A valid invitation and a password of at least 8 characters are required." }, { status: 400 })
    }
    const accepted = await acceptAdminInvitation(token, password)
    if (!accepted) return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 400 })
    return NextResponse.json({ success: true, username: accepted.username })
  } catch {
    return NextResponse.json({ error: "Failed to activate invitation." }, { status: 500 })
  }
}
