import { requireCreatorSession } from "@/lib/creator-auth"
import { CreatorSidebarNav } from "@/components/creator/creator-sidebar-nav"
import { PortalSessionTimeoutWatcher } from "@/components/shared/portal-session-timeout-watcher"
import { PortalHeader } from "@/components/shared/portal-header"

export default async function CreatorPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { creator } = await requireCreatorSession()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <PortalSessionTimeoutWatcher endpoint="/api/creator/session" loginPath="/creator/login" storageKey="creator" />
      <CreatorSidebarNav
        creatorName={creator.fullName}
        creatorCode={creator.creatorId}
        levelLabel={creator.levelLabel || "Starter"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          userName={creator.fullName}
          userMeta={creator.levelLabel || "Starter"}
          profileHref="/creator/profile"
          walletHref="/creator/earnings"
          walletLabel="Earnings & Rewards"
          logoutEndpoint="/api/creator/logout"
          loginPath="/creator/login"
          quickLinks={[
            { href: "/creator", label: "Overview" },
            { href: "/creator/challenges", label: "Challenges" },
            { href: "/creator/earnings", label: "Earnings" },
            { href: "/creator/notifications", label: "Notifications" },
          ]}
          notificationEndpoint="/api/creator/notifications"
        />
        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8">{children}</main>
      </div>
    </div>
  )
}
