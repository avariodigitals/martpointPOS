import { SectionHeader } from "@/components/shared/section-header"

const industries = [
  {
    name: "Supermarkets",
    scenario:
      "Manage thousands of SKUs, fast checkout lanes, and multiple branches with real-time stock visibility.",
  },
  {
    name: "Mini Marts",
    scenario:
      "Track daily sales, monitor fast-moving items, and reorder before you run out of stock.",
  },
  {
    name: "Restaurants",
    scenario:
      "Handle table orders, kitchen tickets, split payments, and track ingredient inventory per outlet.",
  },
  {
    name: "Pharmacies",
    scenario:
      "Manage batch tracking, expiry dates, prescription sales, and regulated inventory with full audit trails.",
  },
  {
    name: "Electronics Stores",
    scenario:
      "Track serial numbers, warranty periods, and high-value stock across showroom and warehouse.",
  },
  {
    name: "Fashion Retailers",
    scenario:
      "Manage sizes, colors, seasons, and styles. See what sells by branch and optimize your stock mix.",
  },
  {
    name: "Distributors",
    scenario:
      "Coordinate large orders, manage delivery routes, track credit sales, and monitor warehouse operations.",
  },
  {
    name: "Wholesalers",
    scenario:
      "Handle bulk pricing tiers, multi-customer invoicing, and stock transfers between depots.",
  },
]

export function IndustryCoverage() {
  return (
    <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="Industries"
          headline="Built for the businesses that power Africa"
          description="Whatever you sell or distribute, MartPoint is designed for your operational reality."
        />

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {industries.map((industry) => (
            <div
              key={industry.name}
              className="group rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-accent/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4 justify-center sm:justify-start">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <h3 className="text-base font-semibold text-foreground">
                  {industry.name}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed text-center sm:text-left">
                {industry.scenario}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
