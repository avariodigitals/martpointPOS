import { redirect } from "next/navigation"
import { getSession } from "@/lib/admin-auth"
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav"
import { PermissionGuard } from "@/components/admin/permission-guard"
import { AdminSessionTimeoutWatcher } from "@/components/admin/admin-session-timeout-watcher"
import { AdminToastProvider } from "@/components/admin/admin-toast"
import { AdminFetchInterceptor } from "@/components/admin/admin-fetch-interceptor"
import { AdminTopbar } from "@/components/admin/admin-topbar"

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/admin/login?expired=1")
  }

  return (
    <AdminToastProvider>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#f4f6fb]">
        <AdminSessionTimeoutWatcher />
        <AdminFetchInterceptor />
        <AdminSidebarNav userName={session.name || session.username} userRole={session.role} />

        <div className="min-w-0 flex-1">
          <AdminTopbar userName={session.name || session.username} userRole={session.role} />
          <main className="min-w-0 overflow-auto px-4 pb-24 pt-5 sm:px-6 md:px-8 md:py-7">
            <PermissionGuard role={session.role}>
              {children}
            </PermissionGuard>
          </main>
        </div>
      </div>
    </AdminToastProvider>
  )
}
