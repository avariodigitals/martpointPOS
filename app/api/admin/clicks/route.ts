import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import fs from "fs"
import path from "path"

const clicksPath = path.join(process.cwd(), "data", "clicks.json")

function readClicks(): Array<{
  id: string
  text: string
  href: string
  pagePath: string
  timestamp: string
  userAgent: string
  ip: string
}> {
  try {
    if (!fs.existsSync(clicksPath)) return []
    const data = fs.readFileSync(clicksPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clicks = readClicks()

  // Total clicks
  const total = clicks.length

  // Clicks today
  const today = new Date().toISOString().split("T")[0]
  const todayClicks = clicks.filter((c) => c.timestamp.startsWith(today)).length

  // Top buttons/links
  const buttonCounts: Record<string, number> = {}
  const pageCounts: Record<string, number> = {}
  const dailyCounts: Record<string, number> = {}

  clicks.forEach((c) => {
    const key = `${c.text}||${c.href}`
    buttonCounts[key] = (buttonCounts[key] || 0) + 1

    pageCounts[c.pagePath] = (pageCounts[c.pagePath] || 0) + 1

    const day = c.timestamp.split("T")[0]
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
  })

  const topButtons = Object.entries(buttonCounts)
    .map(([key, count]) => {
      const [text, href] = key.split("||")
      return { text, href, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const topPages = Object.entries(pageCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Last 30 days daily counts (sorted)
  const last30Days = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)

  // Recent 50 clicks
  const recent = [...clicks].reverse().slice(0, 50)

  return NextResponse.json({
    total,
    today: todayClicks,
    topButtons,
    topPages,
    dailyCounts: last30Days,
    recent,
  })
}

export async function DELETE() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (fs.existsSync(clicksPath)) {
      fs.unlinkSync(clicksPath)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 })
  }
}
