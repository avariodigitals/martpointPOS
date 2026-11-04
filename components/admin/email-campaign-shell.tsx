"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Mail, Users, ShieldCheck } from "lucide-react"

export const emailRoot = "/admin/communications/email"
export const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-retail/20"
export function EmailCampaignShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex items-center justify-between gap-3 border-b pb-4 border-border">
      <Link href={emailRoot} className="flex items-center gap-3"><span className="rounded-xl bg-retail/10 p-2.5 text-retail"><Mail className="h-5 w-5" /></span><div><p className="font-semibold tracking-tight">Email marketing</p><p className="text-xs text-muted-foreground">MartPoint communications</p></div></Link>
      <Link href="/admin/communications/sms" className="text-xs text-muted-foreground hover:text-foreground">Other channels</Link>
    </div>
    <nav aria-label="Email marketing" className="flex gap-2 overflow-x-auto text-sm">
      {[{ href: emailRoot, name: "Campaigns", icon: Mail }, { href: `${emailRoot}/audiences`, name: "Audiences", icon: Users }, { href: "/admin/marketing/suppressions", name: "Suppressions", icon: ShieldCheck }].map(item => {
        const active = item.name === "Campaigns" ? !pathname.includes("audiences") && pathname.startsWith(emailRoot) : pathname === item.href
        return <Link key={item.name} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium ${active ? "bg-white text-retail shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-white/60"}`}><item.icon className="h-4 w-4" />{item.name}</Link>
      })}
    </nav>
    {children}
  </div>
}
export function CampaignBack({ children = "All campaigns" }: { children?: React.ReactNode }) {
  return <Link href={emailRoot} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{children}</Link>
}
export function CampaignStatus({ status }: { status: string }) {
  const colors: Record<string, string> = { sent: "bg-emerald-50 text-emerald-700 ring-emerald-200", failed: "bg-red-50 text-red-700 ring-red-200", partial: "bg-amber-50 text-amber-700 ring-amber-200", scheduled: "bg-blue-50 text-blue-700 ring-blue-200", sending: "bg-violet-50 text-violet-700 ring-violet-200" }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${colors[status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>{status === "sent" ? "Completed" : status}</span>
}
