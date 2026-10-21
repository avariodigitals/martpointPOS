import { requireCreatorSession } from "@/lib/creator-auth"
import { CreatorSidebarNav } from "@/components/creator/creator-sidebar-nav"
import { PortalSessionTimeoutWatcher } from "@/components/shared/portal-session-timeout-watcher"

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
      <main className="flex-1 p-4 pb-24 md:p-8 overflow-auto">{children}</main>
    </div>
  )
}
