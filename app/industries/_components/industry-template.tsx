import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Check, ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { FAQPageSchema } from "@/components/structured-data"

export interface IndustryTemplateData {
  name: string
  slug: string
  category: string
  product: "retail" | "erp"
  description: string
  navVisible?: boolean
  seo: {
    title: string
    description: string
    ogTitle?: string
    ogDescription?: string
  }
  hero: {
    label: string
    headline: string
    paragraph: string
    ctaText: string
    waQuery: string
  }
  painPoints: { icon: LucideIcon; title: string; desc: string }[]
  solutions: { icon: LucideIcon; title: string; desc: string }[]
  capabilities: { icon: LucideIcon; title: string; desc: string }[]
  whyMartPoint: string[]
  testimonial?: {
    quote: string
    author: string
    role: string
    initials: string
  }
  faqs: { q: string; a: string }[]
}

export function IndustryTemplate({ data }: { data: IndustryTemplateData }) {
  const productLabel = data.product === "retail" ? "MartPoint Retail" : "MartPoint Enterprise"
  const pricingHref = data.product === "retail" ? "/pricing" : "/martpoint-erp"

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                {data.hero.label}
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                {data.hero.headline}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                {data.hero.paragraph}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link
                    href={`https://wa.me/+2348036028069?text=${encodeURIComponent(data.hero.waQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.hero.ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={pricingHref}>View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                The Challenges Holding Your {data.name} Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These operational leaks cost African {data.name.toLowerCase()} money every single day. MartPoint was built to eliminate them.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {data.painPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white/95 mb-2">{item.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How MartPoint Helps"
              headline={`Turn ${data.name} Chaos Into Control`}
              description="From the front counter to the back office, every process is connected, tracked and automated."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {data.solutions.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Capabilities"
              headline={`What You Get With ${productLabel}`}
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.capabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <cap.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{cap.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why MartPoint */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Why {data.name} Choose MartPoint
                </h2>
                <div className="mt-8 space-y-5">
                  {data.whyMartPoint.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {data.capabilities.slice(0, 4).map((cap) => (
                    <div
                      key={cap.title}
                      className="rounded-xl border border-border bg-background p-5 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mx-auto mb-3">
                        <cap.icon className="w-5 h-5 text-retail" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{cap.title}</p>
                    </div>
                  ))}
                </div>
                {data.testimonial && (
                  <div className="rounded-2xl border border-border bg-background p-6">
                    <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-3">
                      Customer Story
                    </div>
                    <blockquote className="text-base text-foreground leading-relaxed italic">
                      &ldquo;{data.testimonial.quote}&rdquo;
                    </blockquote>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-sm">
                        {data.testimonial.initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{data.testimonial.author}</div>
                        <div className="text-xs text-muted-foreground">{data.testimonial.role}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline={`Questions ${data.name} Ask`}
            />
            <div className="mt-10 space-y-4">
              {data.faqs.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-border bg-card p-5 cursor-pointer">
                  <summary className="flex items-center justify-between list-none">
                    <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Ready to Run Your {data.name} With Confidence?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join {data.name.toLowerCase()} across Africa using MartPoint to eliminate waste, speed up operations and grow profit.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link
                    href={`https://wa.me/+2348036028069?text=${encodeURIComponent(data.hero.waQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={pricingHref}>View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      <FAQPageSchema faqs={data.faqs.map((f) => ({ question: f.q, answer: f.a }))} />
      </main>
      <Footer />
    </>
  )
}
