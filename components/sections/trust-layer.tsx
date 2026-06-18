import { Eye, PackageCheck, SlidersHorizontal, LineChart } from "lucide-react"

const metrics = [
  {
    icon: Eye,
    value: "Sales Visibility",
    description:
      "See every transaction, every branch, every cashier in real time. No more guessing what sold today.",
  },
  {
    icon: PackageCheck,
    value: "Stock Accuracy",
    description:
      "Track inventory across all locations. Know what you have, where it is, and when to reorder.",
  },
  {
    icon: SlidersHorizontal,
    value: "Operational Control",
    description:
      "Manage staff, approvals, and workflows from a single dashboard. Standardize how your business runs.",
  },
  {
    icon: LineChart,
    value: "Business Insights",
    description:
      "Make decisions based on data, not assumptions. Reports that actually tell you what to do next.",
  },
]

export function TrustLayer() {
  return (
    <section className="w-full bg-background py-16 md:py-24">
      <div className="container-martpoint">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Businesses can&apos;t grow with disconnected tools.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            MartPoint centralizes sales, inventory, operations, and reporting —
            so you see the full picture and act on it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <div
              key={metric.value}
              className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-accent/30 hover:shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors">
                <metric.icon className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {metric.value}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
