"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Trophy,
  FileVideo,
  BarChart3,
  Link2,
  Wallet,
  GraduationCap,
  FolderOpen,
  BookOpen,
  Map,
  HelpCircle,
  LifeBuoy,
  Bell,
  User,
  type LucideIcon,
} from "lucide-react"
import { PortalMobileNav } from "@/components/shared/portal-mobile-nav"
import { PortalSidebar } from "@/components/shared/portal-sidebar"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: "/creator", label: "Overview", icon: LayoutDashboard },
  { href: "/creator/challenges", label: "Challenges", icon: Trophy },
  { href: "/creator/content", label: "My Content", icon: FileVideo },
  { href: "/creator/performance", label: "Performance", icon: BarChart3 },
  { href: "/creator/referrals", label: "Referrals", icon: Link2 },
  { href: "/creator/earnings", label: "Earnings & Rewards", icon: Wallet },
  { href: "/creator/learn", label: "Learn MartPoint", icon: GraduationCap },
  { href: "/creator/guides", label: "Business Guides", icon: Map },
  { href: "/creator/kit", label: "Creator Kit", icon: FolderOpen },
  { href: "/creator/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/creator/faq", label: "FAQ", icon: HelpCircle },
  { href: "/creator/support", label: "Help & Support", icon: LifeBuoy },
  { href: "/creator/notifications", label: "Notifications", icon: Bell },
  { href: "/creator/profile", label: "Profile", icon: User },
]

// Primary destinations shown in the mobile bottom quick menu (order follows navItems).
const QUICK_HREFS = ["/creator", "/creator/challenges", "/creator/earnings", "/creator/learn"]
const QUICK_LABELS: Record<string, string> = {
  "/creator/earnings": "Earnings",
  "/creator/learn": "Learn",
}

export function CreatorSidebarNav({
  creatorName,
  creatorCode,
  levelLabel,
}: {
  creatorName: string
  creatorCode: string
  levelLabel: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/creator/logout", { method: "POST" })
    router.push("/creator/login")
    router.refresh()
  }

  const quickItems = navItems
    .filter((item) => QUICK_HREFS.includes(item.href))
    .map((item) => ({ ...item, label: QUICK_LABELS[item.href] ?? item.label }))

  const isItemActive = (href: string) =>
    href === "/creator" ? pathname === "/creator" : pathname.startsWith(href)

  return (
    <>
      <PortalMobileNav
        title="Creator Portal"
        subtitle={creatorName}
        userName={creatorName}
        quickItems={quickItems}
        sections={[{ items: navItems }]}
        isItemActive={isItemActive}
        onLogout={handleLogout}
        logoutLabel="Sign out"
      />

      <PortalSidebar
        title="Creator Portal"
        subtitle={creatorName}
        meta={[[creatorCode, levelLabel].filter(Boolean).join(" · ")].filter(Boolean)}
        sections={[{ items: navItems }]}
        userName={creatorName}
        onLogout={handleLogout}
        logoutLabel="Sign out"
        storageKey="creator-nav"
        isItemActive={isItemActive}
      />
    </>
  )
}
