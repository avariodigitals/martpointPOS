import { redirect } from "next/navigation"
import { requirePartnerSession, getPartnerById, getPartnerUserById, getPartnerCapabilities } from "@/lib/partner-auth"
import { PartnerSidebarNav } from "@/components/partner/partner-sidebar-nav"
import { PortalSessionTimeoutWatcher } from "@/components/shared/portal-session-timeout-watcher"
import { PortalHeader } from "@/components/shared/portal-header"
import { partnerUserHasPermission } from "@/lib/partner-permissions"

export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requirePartnerSession()
  const [partner, user, capabilities] = await Promise.all([
    getPartnerById(session.partnerId),
    getPartnerUserById(session.partnerUserId),
    getPartnerCapabilities(session.partnerId),
  ])

  if (!partner || !user) {
    redirect("/partner/login")
  }

  const quickLinks = [
    { href: "/partner", label: "Dashboard" },
    ...(partnerUserHasPermission(user.role, "leads:view") ? [{ href: "/partner/leads", label: "Leads" }] : []),
    ...(partnerUserHasPermission(user.role, "quotes:request_own") ? [{ href: "/partner/quotes", label: "Quotes" }] : []),
    ...(partnerUserHasPermission(user.role, "customers:view_assigned") ? [{ href: "/partner/customers", label: "Customers" }] : []),
    ...(partnerUserHasPermission(user.role, "partner:profile:view") ? [{ href: "/partner/profile", label: "Profile" }] : []),
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <PortalSessionTimeoutWatcher endpoint="/api/partner/session" loginPath="/partner/login" storageKey="partner" />
      <PartnerSidebarNav
        partnerName={partner.displayName || partner.businessName}
        partnerId={partner.partnerId}
        userName={user.fullName}
        userRole={user.role}
        capabilities={capabilities}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          userName={user.fullName}
          userMeta={user.role.replace("PARTNER_", "")}
          profileHref="/partner/profile"
          walletHref="/partner/commissions"
          walletLabel="Wallet & Earnings"
          logoutEndpoint="/api/partner/logout"
          loginPath="/partner/login"
          quickLinks={quickLinks}
          notificationEndpoint="/api/partner/notifications"
        />
        <main className="flex-1 overflow-auto p-6 pb-24 md:p-8">{children}</main>
      </div>
    </div>
  )
}
