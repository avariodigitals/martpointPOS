import { SectionHeader } from "@/components/shared/section-header"
import { XCircle, Clock, FileX } from "lucide-react"

const pains = [
  {
    icon: XCircle,
    headline: "You don&apos;t know what sold today",
    description:
      "Sales data is scattered across notebooks, spreadsheets, and memory. You can&apos;t see trends, bestsellers, or slow movers.",
  },
  {
    icon: Clock,
    headline: "Inventory is always a surprise",
    description:
      "Stock counts happen monthly if at all. You discover shortages at the worst time — when a customer is standing at your counter.",
  },
  {
    icon: FileX,
    headline: "Operations run on WhatsApp and hope",
    description:
      "Staff schedules, purchase requests, and approvals bounce between messages and phone calls. Nothing is trackable.",
  },
]

export function PainPoints() {
  return (
    <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="The Problem"
          headline="Running a business in Nigeria shouldn&apos;t feel this hard"
          description="These are the daily realities we hear from business owners across Lagos, Abuja, Port Harcourt, and everywhere in between."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {pains.map((pain, index) => (
            <div
              key={index}
              className="relative rounded-2xl bg-background border border-border p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-6">
                <pain.icon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground leading-tight mb-3">
                {pain.headline}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {pain.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
