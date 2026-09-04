import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Landmark, Users, Handshake, Ticket, Shield } from "lucide-react"

const REPORT_SECTIONS = [
  {
    title: "Commercial",
    icon: Landmark,
    href: "/admin/finance",
    items: ["Revenue collected", "Revenue by product/plan", "Outstanding invoices", "Overdue invoices", "Renewals", "Commissions"],
  },
  {
    title: "Customers",
    icon: Users,
    href: "/admin/businesses",
    items: ["New businesses", "Active businesses", "Onboarding businesses", "Customer health", "At-risk customers", "Churned customers"],
  },
  {
    title: "Partners",
    icon: Handshake,
    href: "/admin/partners",
    items: ["Applications", "Active partners", "Partner leads", "Won opportunities", "Attributed revenue", "Commission paid"],
  },
  {
    title: "Support",
    icon: Ticket,
    href: "/admin/support",
    items: ["Tickets opened/resolved", "Open backlog", "Priority distribution", "First-response SLA", "Resolution SLA", "Escalations"],
  },
  {
    title: "Operations",
    icon: Shield,
    href: "/admin/tasks",
    items: ["Pending deployments", "Onboarding completion", "Compliance status", "Open incidents", "Critical incidents"],
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Cross-module operational reporting centre.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={section.href} className="text-xs text-retail hover:underline mt-4 inline-block">
                  Open source module →
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Full CSV export and consolidated report views are in development. Use the source modules for live data.
      </p>
    </div>
  )
}
