"use client"

import Link from "next/link"
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
  Bell,
  User,
  LogOut,
  type LucideIcon,
} from "lucide-react"

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
  { href: "/creator/notifications", label: "Notifications", icon: Bell },
  { href: "/creator/profile", label: "Profile", icon: User },
]

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

  return (
    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-[#0A0F1C] text-white md:min-h-screen md:sticky md:top-0 md:self-start">
      <div className="p-6">
        <h1 className="text-lg font-bold text-white">Creator Portal</h1>
        <p className="text-xs text-gray-400 mt-1 truncate">{creatorName}</p>
        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
          {creatorCode}{levelLabel ? ` · ${levelLabel}` : ""}
        </p>
      </div>

      <nav className="px-4 pb-2 grid grid-cols-2 md:grid-cols-1 gap-1">
        {navItems.map((item) => {
          const active = item.href === "/creator" ? pathname === "/creator" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-retail text-white" : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
