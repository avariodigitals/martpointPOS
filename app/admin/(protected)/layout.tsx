import { redirect } from "next/navigation"
import { getSession } from "@/lib/admin-auth"
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav"
import { PermissionGuard } from "@/components/admin/permission-guard"
import { AdminSessionTimeoutWatcher } from "@/components/admin/admin-session-timeout-watcher"

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <AdminSessionTimeoutWatcher />
      <AdminSidebarNav userName={session.name || session.username} userRole={session.role} />

      {/* Main Content */}
      <main className="flex-1 p-6 pb-24 md:p-8 overflow-auto">
        <PermissionGuard role={session.role}>
          {children}
        </PermissionGuard>
      </main>
    </div>
  )
}
