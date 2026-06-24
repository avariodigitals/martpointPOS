import { NextResponse } from "next/server"
import { setAdminCookie } from "@/lib/admin-auth"

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Admin password not configured. Set ADMIN_PASSWORD in .env.local" },
        { status: 500 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    await setAdminCookie()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to process login" }, { status: 500 })
  }
}
