import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Globe,
  ArrowRight,
  Users,
  Funnel,
  Phone,
  CheckCircle2,
  FileText,
  MousePointerClick,
  ArrowUpRight,
} from "lucide-react"
import Link from "next/link"
import fs from "fs"
import path from "path"

function getSettings() {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json")
    if (!fs.existsSync(settingsPath)) return null
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

function getLeads() {
  try {
    const leadsPath = path.join(process.cwd(), "data", "leads.json")
    if (!fs.existsSync(leadsPath)) return []
    const data = fs.readFileSync(leadsPath, "utf-8")
    return (JSON.parse(data).leads || []) as Array<{
      id: string
      fullName: string
      businessName: string
      email: string
      phone: string
      businessType: string
      productInterest: string
      source: string
      status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
      submittedAt: string
    }>
  } catch {
    return []
  }
}

function getBlogPosts() {
  try {
    const blogPath = path.join(process.cwd(), "data", "blog.json")
    if (!fs.existsSync(blogPath)) return []
    const data = fs.readFileSync(blogPath, "utf-8")
    return (JSON.parse(data).posts || []) as Array<{ status: string }>
  } catch {
    return []
  }
}

function getClicks() {
  try {
    const clicksPath = path.join(process.cwd(), "data", "clicks.json")
    if (!fs.existsSync(clicksPath)) return []
    const data = fs.readFileSync(clicksPath, "utf-8")
    return JSON.parse(data) as Array<{ timestamp: string }>
  } catch {
    return []
  }
}

function getUsers() {
  try {
    const usersPath = path.join(process.cwd(), "data", "users.json")
    if (!fs.existsSync(usersPath)) return []
    const data = fs.readFileSync(usersPath, "utf-8")
    return (JSON.parse(data).users || []) as Array<unknown>
  } catch {
    return []
  }
}

const STAGE_COLORS: Record<string, string> = {
  New: "bg-info",
  Contacted: "bg-warning",
  Qualified: "bg-retail",
  Proposal: "bg-proposal",
  Won: "bg-success",
  Lost: "bg-destructive",
}

export default async function AdminDashboardPage() {
  const settings = getSettings()
  const leads = getLeads()
  const posts = getBlogPosts()
  const clicks = getClicks()
  const users = getUsers()

  const seo = settings?.seo
  const analytics = settings?.analytics
  const general = settings?.general

  const gaActive = analytics?.ga4MeasurementId && analytics.ga4MeasurementId.startsWith("G-")

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split("T")[0]

  // Lead stats
  const totalLeads = leads.length
  const newThisWeek = leads.filter((l) => new Date(l.submittedAt) >= weekAgo).length
  const contacted = leads.filter((l) => l.status === "Contacted").length
  const won = leads.filter((l) => l.status === "Won").length
  const conversionRate = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0

  // Pipeline counts
  const stages = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const
  const stageCounts = Object.fromEntries(stages.map((s) => [s, leads.filter((l) => l.status === s).length]))

  // Recent leads (last 5)
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)

  // Blog stats
  const totalPosts = posts.length
  const publishedPosts = posts.filter((p) => p.status === "published").length

  // Clicks stats
  const totalClicks = clicks.length
  const todayClicks = clicks.filter((c) => c.timestamp.startsWith(todayStr)).length

  // Team stats
  const teamSize = users.length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of leads, content, activity, and site health.</p>
      </div>

      {/* ─── Top Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Leads</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">+{newThisWeek} this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Contacted</p>
                <p className="text-2xl font-bold text-warning">{contacted}</p>
              </div>
              <Phone className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalLeads > 0 ? Math.round((contacted / totalLeads) * 100) : 0}% of pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Won / Closed</p>
                <p className="text-2xl font-bold text-success">{won}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{conversionRate}% conversion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Tracker Clicks</p>
                <p className="text-2xl font-bold">{totalClicks}</p>
              </div>
              <MousePointerClick className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{todayClicks} today</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Middle Row: Pipeline + Content + Team ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pipeline Mini Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Funnel className="w-4 h-4 text-muted-foreground" />
              Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.map((stage) => {
              const count = stageCounts[stage] || 0
              const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{stage}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${STAGE_COLORS[stage]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <Link href="/admin/leads" className="inline-flex items-center gap-1 text-xs text-retail mt-2 hover:underline">
              View all leads <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Content Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Blog Posts</span>
              <span className="font-semibold">{totalPosts}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Published</span>
              <span className="font-semibold text-success">{publishedPosts}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Drafts</span>
              <span className="font-semibold text-warning">{totalPosts - publishedPosts}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-retail"
                style={{ width: `${totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0}%` }}
              />
            </div>
            <Link href="/admin/blog" className="inline-flex items-center gap-1 text-xs text-retail hover:underline">
              Manage blog <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Site Health + Team */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                Site Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">SEO Title</span>
                <span className={`font-medium ${seo?.title ? "text-success" : "text-destructive"}`}>
                  {seo?.title ? "OK" : "Missing"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">GA4 Tracking</span>
                <span className={`font-medium ${gaActive ? "text-success" : "text-warning"}`}>
                  {gaActive ? "Active" : "Not Set"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Company Name</span>
                <span className="font-medium">{general?.companyName || "MartPoint"}</span>
              </div>
              <Link href="/admin/settings" className="inline-flex items-center gap-1 text-xs text-retail hover:underline">
                Edit settings <ArrowRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Team Members</p>
                  <p className="text-2xl font-bold">{teamSize}</p>
                </div>
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs text-retail mt-2 hover:underline">
                Manage team <ArrowRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Recent Leads ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Leads</CardTitle>
            <CardDescription>Latest form submissions across the site</CardDescription>
          </div>
          <Link href="/admin/leads" className="text-xs text-retail hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet. Submissions from contact, demo, and quote forms will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Business</th>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium">{lead.fullName}</td>
                      <td className="py-2.5 text-muted-foreground">{lead.businessName}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {lead.productInterest === "retail" ? "Retail" : lead.productInterest === "erp" ? "ERP" : "Not Sure"}
                      </td>
                      <td className="py-2.5">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium">
                          {lead.source}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(lead.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Quick Tips ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Quick steps to keep everything running smoothly</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              <span className="text-foreground font-medium">Review new leads daily</span> in the{" "}
              <Link href="/admin/leads" className="text-retail hover:underline">Leads</Link>{" "}
              section and move them through the pipeline.
            </li>
            <li>
              <span className="text-foreground font-medium">Set your GA4 Measurement ID</span> in the{" "}
              <Link href="/admin/analytics" className="text-retail hover:underline">Analytics</Link>{" "}
              section to start tracking visitors.
            </li>
            <li>
              <span className="text-foreground font-medium">Update SEO metadata</span> in the{" "}
              <Link href="/admin/seo" className="text-retail hover:underline">SEO</Link>{" "}
              section to improve search rankings.
            </li>
            <li>
              <span className="text-foreground font-medium">Verify contact details</span> in{" "}
              <Link href="/admin/settings" className="text-retail hover:underline">Settings</Link>{" "}
              so leads reach the right inbox.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
