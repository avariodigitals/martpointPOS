import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, FileText, Megaphone, MessageCircle } from "lucide-react"
import { getSession } from "@/lib/admin-auth"
import { hasGrowthWorkspaceAccess } from "@/lib/admin-navigation"
import { hasPermission } from "@/lib/admin-types"

type WorkspaceLink = { href: string; label: string }

function WorkspaceCard({ title, description, links, icon: Icon }: {
  title: string
  description: string
  links: WorkspaceLink[]
  icon: typeof Megaphone
}) {
  if (!links.length) return null
  return <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span>
      <div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
    </div>
    <div className="mt-5 space-y-1 border-t border-slate-100 pt-3">
      {links.map((link) => <Link key={link.href} href={link.href} className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-blue-800">
        {link.label}<ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
      </Link>)}
    </div>
  </section>
}

export default async function GrowthWorkspacePage() {
  const session = await getSession()
  if (!session || !hasGrowthWorkspaceAccess(session.role)) redirect("/admin")
  const can = (permission: string) => hasPermission(session.role, permission)

  const marketingLinks = can("marketing") ? [
    { href: "/admin/marketing", label: "Email campaigns" },
    { href: "/admin/marketing/audiences", label: "Audiences & newsletter opt-ins" },
    { href: "/admin/marketing/suppressions", label: "Unsubscribes & suppressions" },
  ] : []
  const contentLinks = [
    { href: "/admin/blog", label: "Blog", permission: "blog" },
    { href: "/admin/faqs", label: "FAQs", permission: "faqs" },
    { href: "/admin/brochure", label: "Brochure", permission: "partners" },
    { href: "/admin/seo", label: "SEO", permission: "seo" },
    { href: "/admin/tracker", label: "Website tracker", permission: "tracker" },
    { href: "/admin/tracker/referrers", label: "Traffic sources", permission: "tracker" },
    { href: "/admin/analytics", label: "Analytics", permission: "analytics" },
  ].filter((link) => can(link.permission))
  const communicationLinks = can("marketing") && can("leads") ? [
    { href: "/admin/communications", label: "Email, SMS & automations" },
  ] : []

  return <div className="mx-auto max-w-6xl space-y-7">
    <header className="rounded-2xl bg-slate-950 px-6 py-7 text-white sm:px-8 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-300">Growth workspace</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Marketing, content and communications</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Choose a dedicated workspace. Campaigns, website content and customer communications each keep their own tools and audiences.</p>
    </header>
    <div className="grid gap-4 lg:grid-cols-3">
      <WorkspaceCard title="Marketing" description="Plan campaigns and manage opted-in audiences." links={marketingLinks} icon={Megaphone} />
      <WorkspaceCard title="Content & website" description="Maintain public content, discoverability and web performance." links={contentLinks} icon={FileText} />
      <WorkspaceCard title="Communications" description="Continue lead conversations and manage SMS, templates and automations." links={communicationLinks} icon={MessageCircle} />
    </div>
  </div>
}
