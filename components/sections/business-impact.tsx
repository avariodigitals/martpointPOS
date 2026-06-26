import { SectionHeader } from "@/components/shared/section-header"

const impacts = [
  {
    stat: "40%",
    label: "Faster checkout",
    description: "Modern POS that processes transactions in seconds, not minutes.",
  },
  {
    stat: "99%",
    label: "Stock accuracy",
    description: "Real-time inventory updates eliminate manual counting errors.",
  },
  {
    stat: "3x",
    label: "Faster reporting",
    description: "Reports that used to take a weekend now generate in one click.",
  },
  {
    stat: "60%",
    label: "Less admin time",
    description: "Automated approvals, scheduling, and invoicing free up your team.",
  },
]

export function BusinessImpact() {
  return (
    <section className="w-full bg-foreground py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="Impact"
          headline="Results that show up in your business, not just on a dashboard"
          description="These are the outcomes our customers report after switching to MartPoint."
          dark
        />

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {impacts.map((impact) => (
            <div
              key={impact.label}
              className="rounded-xl bg-white/5 border border-white/10 p-6 text-center md:text-left"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-accent mb-2">
                {impact.stat}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                {impact.label}
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">
                {impact.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
