export const revalidate = 60

import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { StatusSubscribeForm } from "@/components/status/subscribe-form"
import { StatusTabs } from "@/components/status/status-tabs"
import { getStatusPageData } from "@/lib/status-page"
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Activity,
} from "lucide-react"

export const metadata: Metadata = {
  title: "System Status — MartPoint Solutions",
  description:
    "Real-time status and uptime history for MartPoint services — POS, payments, APIs, sync, and dashboards. Subscribe for incident and maintenance updates.",
  alternates: { canonical: "/status" },
  openGraph: {
    title: "MartPoint System Status",
    description: "Live operational status, uptime history, and incident reports for MartPoint services.",
    url: "https://martpoint.com.ng/status",
  },
}

function OverallBanner({ overall }: { overall: string }) {
  const config: Record<string, { label: string; classes: string; icon: React.ElementType }> = {
    operational: {
      label: "All Systems Operational",
      classes: "bg-green-600 text-white",
      icon: CheckCircle2,
    },
    degraded: {
      label: "Degraded Performance",
      classes: "bg-amber-400 text-amber-950",
      icon: AlertTriangle,
    },
    partial: {
      label: "Partial System Outage",
      classes: "bg-orange-500 text-white",
      icon: AlertTriangle,
    },
    major: {
      label: "Major System Outage",
      classes: "bg-red-600 text-white",
      icon: AlertOctagon,
    },
    maintenance: {
      label: "Scheduled Maintenance In Progress",
      classes: "bg-blue-600 text-white",
      icon: Wrench,
    },
  }
  const c = config[overall] || config.operational
  const Icon = c.icon
  return (
    <div className={`rounded-xl px-6 py-5 flex items-center justify-center gap-3 ${c.classes}`}>
      <Icon className="w-6 h-6" />
      <h2 className="text-xl md:text-2xl font-bold">{c.label}</h2>
    </div>
  )
}

export default async function StatusPage() {
  const data = await getStatusPageData()

  return (
    <>
      <Header />
      <main>
        {/* Hero + overall banner */}
        <section className="w-full bg-background">
          <div className="container-martpoint py-14 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                  System Status
                </span>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  MartPoint Status
                </h1>
                <p className="mt-4 text-muted-foreground">
                  Live availability for every MartPoint service.{" "}
                  <span className="inline-flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Refreshed continuously.
                  </span>
                </p>
              </div>

              <OverallBanner overall={data.overall} />

              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5">
                <p className="text-sm font-medium mb-3">
                  Get email notifications whenever we create, update, or resolve an incident.
                </p>
                <StatusSubscribeForm />
              </div>
            </div>
          </div>
        </section>

        <StatusTabs data={data} />
      </main>
      <Footer />
    </>
  )
}
