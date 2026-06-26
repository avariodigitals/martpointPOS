import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ total: 0, today: 0, topButtons: [], topPages: [], dailyCounts: [], recent: [] })
  }

  const { data, error } = await supabase
    .from("clicks")
    .select("*")
    .order("timestamp", { ascending: true })

  if (error) {
    console.error("[Supabase Clicks Error]", error)
    return NextResponse.json({ error: "Failed to fetch clicks" }, { status: 500 })
  }

  const clicks = data || []

  // Total clicks
  const total = clicks.length

  // Clicks today
  const today = new Date().toISOString().split("T")[0]
  const todayClicks = clicks.filter((c: Record<string, unknown>) => (c.timestamp as string).startsWith(today)).length

  // Top buttons/links
  const buttonCounts: Record<string, number> = {}
  const pageCounts: Record<string, number> = {}
  const dailyCounts: Record<string, number> = {}

  clicks.forEach((c: Record<string, unknown>) => {
    const key = `${c.text}||${c.href}`
    buttonCounts[key] = (buttonCounts[key] || 0) + 1
    pageCounts[c.page_path as string] = (pageCounts[c.page_path as string] || 0) + 1
    const day = (c.timestamp as string).split("T")[0]
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
  const recent = [...clicks].reverse().slice(0, 50).map((c: Record<string, unknown>) => ({
    id: c.id,
    text: c.text,
    href: c.href,
    pagePath: c.page_path,
    referrer: c.referrer,
    timestamp: c.timestamp,
    userAgent: c.user_agent,
    ip: c.ip,
  }))

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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase.from("clicks").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  if (error) {
    console.error("[Supabase Clicks Delete Error]", error)
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
