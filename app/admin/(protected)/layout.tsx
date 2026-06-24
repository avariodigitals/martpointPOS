import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import Link from "next/link"
import { LayoutDashboard, Settings, BarChart3, Search, FileText, MousePointerClick } from "lucide-react"
import { LogoutButton } from "@/components/admin/logout-button"

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card">
        <div className="p-6">
          <h1 className="text-xl font-bold text-foreground">MartPoint Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">Manage your site</p>
        </div>
        <nav className="px-4 pb-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/seo"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Search className="w-4 h-4" />
            SEO
          </Link>
          <Link
            href="/admin/blog"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <FileText className="w-4 h-4" />
            Blog
          </Link>
          <Link
            href="/admin/tracker"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <MousePointerClick className="w-4 h-4" />
            Tracker
          </Link>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <div className="pt-4 border-t border-border mt-4">
            <LogoutButton />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
