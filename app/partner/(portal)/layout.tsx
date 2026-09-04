import { redirect } from "next/navigation"
import { requirePartnerSession, getPartnerById, getPartnerUserById, getPartnerCapabilities } from "@/lib/partner-auth"
import { PartnerSidebarNav } from "@/components/partner/partner-sidebar-nav"

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <PartnerSidebarNav
        partnerName={partner.displayName || partner.businessName}
        partnerId={partner.partnerId}
        userName={user.fullName}
        userRole={user.role}
        capabilities={capabilities}
      />
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
