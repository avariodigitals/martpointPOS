"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 w-full"
    >
      <LogOut className="w-4 h-4" />
      Logout
    </button>
  )
}
