import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, BarChart3, Globe, ArrowRight } from "lucide-react"
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

export default async function AdminDashboardPage() {
  const settings = getSettings()

  const seo = settings?.seo
  const analytics = settings?.analytics
  const general = settings?.general

  const gaActive = analytics?.ga4MeasurementId && analytics.ga4MeasurementId.startsWith("G-")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your site configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* SEO Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SEO Status</CardTitle>
            <Search className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{seo?.title ? "Configured" : "Not Set"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {seo?.title || "No title configured"}
            </p>
            <Link
              href="/admin/seo"
              className="inline-flex items-center gap-1 text-xs text-retail mt-3 hover:underline"
            >
              Manage SEO <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Analytics Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Analytics</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gaActive ? "Active" : "Not Configured"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.ga4MeasurementId || "No GA4 ID set"}
            </p>
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-1 text-xs text-retail mt-3 hover:underline"
            >
              Configure <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Site Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Site Info</CardTitle>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{general?.companyName || "MartPoint"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {general?.contactEmail || "No email set"}
            </p>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-1 text-xs text-retail mt-3 hover:underline"
            >
              Edit Settings <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Quick steps to configure your site</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
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
