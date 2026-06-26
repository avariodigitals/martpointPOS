import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import fs from "fs"
import path from "path"

const clicksPath = path.join(process.cwd(), "data", "clicks.json")

interface ClickRecord {
  id: string
  text: string
  href: string
  pagePath: string
  referrer: string
  timestamp: string
  userAgent: string
  ip: string
}

function readClicks(): ClickRecord[] {
  try {
    if (!fs.existsSync(clicksPath)) return []
    const data = fs.readFileSync(clicksPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function classifyReferrer(referrer: string): string {
  if (!referrer || referrer === "") return "Direct"
  const url = referrer.toLowerCase()

  if (url.includes("wa.me") || url.includes("whatsapp")) return "WhatsApp"
  if (url.includes("facebook.com") || url.includes("fb.com") || url.includes("m.facebook")) return "Facebook"
  if (url.includes("instagram.com")) return "Instagram"
  if (url.includes("snapchat.com")) return "Snapchat"
  if (url.includes("twitter.com") || url.includes("x.com") || url.includes("t.co")) return "Twitter / X"
  if (url.includes("linkedin.com")) return "LinkedIn"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube"
  if (url.includes("google.com") || url.includes("google.ng")) return "Google"
  if (url.includes("bing.com")) return "Bing"
  if (url.includes("tiktok.com")) return "TikTok"
  if (url.includes("reddit.com")) return "Reddit"
  if (url.includes("pinterest.com")) return "Pinterest"

  return "Other"
}

export async function GET(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") || "all"

  const clicks = readClicks()

  // Filter by period
  const now = new Date()
  let filtered = clicks

  if (period === "7d") {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 7)
    filtered = clicks.filter((c) => new Date(c.timestamp) >= cutoff)
  } else if (period === "30d") {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 30)
    filtered = clicks.filter((c) => new Date(c.timestamp) >= cutoff)
  } else if (period === "90d") {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 90)
    filtered = clicks.filter((c) => new Date(c.timestamp) >= cutoff)
  }

  // Referrer breakdown
  const referrerCounts: Record<string, number> = {}
  const referrerDaily: Record<string, Record<string, number>> = {}
  const landingPages: Record<string, number> = {}

  for (const c of filtered) {
    const source = classifyReferrer(c.referrer)
    referrerCounts[source] = (referrerCounts[source] || 0) + 1

    const day = c.timestamp.split("T")[0]
    if (!referrerDaily[day]) referrerDaily[day] = {}
    referrerDaily[day][source] = (referrerDaily[day][source] || 0) + 1

    const page = c.pagePath || "/"
    landingPages[page] = (landingPages[page] || 0) + 1
  }

  const sources = Object.entries(referrerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const totalClicks = filtered.length

  // Daily trend for top 5 sources
  const top5Sources = sources.slice(0, 5).map((s) => s.name)
  const days = Array.from(new Set(filtered.map((c) => c.timestamp.split("T")[0]))).sort()
  const dailyTrend = days.map((day) => {
    const entry: Record<string, number | string> = { day }
    for (const source of top5Sources) {
      entry[source] = referrerDaily[day]?.[source] || 0
    }
    return entry
  })

  const topPages = Object.entries(landingPages)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    totalClicks,
    sources,
    dailyTrend,
    topPages,
    period,
  })
}
