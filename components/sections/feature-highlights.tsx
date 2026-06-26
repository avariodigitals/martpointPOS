import { SectionHeader } from "@/components/shared/section-header"
import { Smartphone, Zap, Shield, Globe } from "lucide-react"

const features = [
  {
    icon: Smartphone,
    title: "Works on any device",
    description:
      "Your phone, tablet, laptop, or desktop. MartPoint runs in the browser with no installation needed. Check sales while stuck in Lagos traffic.",
  },
  {
    icon: Zap,
    title: "Fast enough for a busy store",
    description:
      "No delays at checkout. No spinning wheels when you run a report. Built to stay responsive even with hundreds of daily transactions.",
  },
  {
    icon: Shield,
    title: "Your data stays yours",
    description:
      "End-to-end encryption, role-based access, and audit trails for every action. Your business data is protected and always backed up.",
  },
  {
    icon: Globe,
    title: "Built for Africa, from day one",
    description:
      "Naira pricing, local tax configurations, African business structures, and support that understands your market. Not an afterthought.",
  },
]

export function FeatureHighlights() {
  return (
    <section id="whats-new" className="w-full bg-background py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="Why MartPoint"
          headline="Software that respects your time and your business"
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <feature.icon className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
