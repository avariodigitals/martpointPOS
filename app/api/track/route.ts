import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const clicksPath = path.join(process.cwd(), "data", "clicks.json")

function readClicks() {
  try {
    if (!fs.existsSync(clicksPath)) return []
    const data = fs.readFileSync(clicksPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function writeClicks(clicks: unknown[]) {
  try {
    const dir = path.dirname(clicksPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(clicksPath, JSON.stringify(clicks, null, 2), "utf-8")
  } catch {
    // ignore
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, href, pagePath } = body

    if (!text || !pagePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const clicks = readClicks()
    clicks.push({
      id: crypto?.randomUUID?.() || Date.now().toString(),
      text: String(text).slice(0, 100),
      href: String(href || "").slice(0, 500),
      pagePath: String(pagePath).slice(0, 200),
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get("user-agent")?.slice(0, 200) || "",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    })

    // Keep last 5000 entries
    if (clicks.length > 5000) {
      clicks.splice(0, clicks.length - 5000)
    }

    writeClicks(clicks)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
