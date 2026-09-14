import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, ChevronDown } from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"
import type { IndustryData } from "@/lib/industries"

interface IndustryPageProps {
  industry: IndustryData
}

export function IndustryPage({ industry }: IndustryPageProps) {
  const labelColor = industry.product === "retail" ? "text-retail" : "text-erp"
  const waHref = `https://wa.me/+2348036028069?text=${encodeURIComponent(industry.hero.waQuery)}`

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className={`inline-block text-xs font-semibold uppercase tracking-widest mb-4 ${labelColor}`}>
                {industry.hero.label}
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                {industry.hero.headline}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                {industry.hero.paragraph}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant={industry.product === "retail" ? "retail" : "erp"}>
                  <Link href={waHref} target="_blank" rel="noopener noreferrer">
                    {industry.hero.ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">View Pricing</Link>
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
                The Daily Challenges We Solve
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These operational gaps cost {industry.name.toLowerCase()} profit and customers. MartPoint was built to close every one.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {industry.painPoints.map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10">
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

        {/* How it works / Solutions */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How It Works"
              headline={`How MartPoint Helps ${industry.name}`}
              description="Every feature is designed for your daily workflow, from the first customer to the final report."
            />
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="relative">
                {industry.solutions.map((step, i) => (
                  <div key={step.title} className="flex gap-4 mb-8 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-retail text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      {i < industry.solutions.length - 1 && <div className="w-px h-full bg-retail/20 my-2" />}
                    </div>
                    <div className="pb-2">
                      <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Capabilities"
              headline={`What You Get With MartPoint for ${industry.name}`}
              description="Built-in tools that work out of the box, with no IT team required."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {industry.capabilities.map((cap) => (
                <div key={cap.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-retail/10 flex items-center justify-center mb-4">
                    <cap.icon className="w-6 h-6 text-retail" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-2">{cap.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why MartPoint */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-5xl mx-auto">
            <SectionHeader
              label="Why MartPoint"
              headline={`Why ${industry.name} Choose MartPoint`}
              description="The difference between running on hope and running on numbers."
            />
            <div className="mt-14 rounded-2xl border border-retail/20 bg-background p-8">
              <div className="space-y-4">
                {industry.whyMartPoint.map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                    <span className="text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        {industry.testimonial ? (
          <section className="w-full bg-background py-16 md:py-24">
            <div className="container-martpoint max-w-3xl mx-auto text-center">
              <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
                <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-4">Customer Story</div>
                <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed italic max-w-2xl mx-auto">
                  &ldquo;{industry.testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">{industry.testimonial.initials}</div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">{industry.testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{industry.testimonial.role}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline={`Questions ${industry.name} Ask`} />
            <div className="mt-10 space-y-4">
              {industry.faqs.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-border bg-background p-5 cursor-pointer">
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
                See What MartPoint Can Do For {industry.name}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join {industry.name.toLowerCase()} across Africa using MartPoint to sell more, waste less and make confident decisions with real business intelligence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant={industry.product === "retail" ? "retail" : "erp"}>
                  <Link href={waHref} target="_blank" rel="noopener noreferrer">
                    {industry.hero.ctaText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <FAQPageSchema faqs={industry.faqs.map((f) => ({ question: f.q, answer: f.a }))} />
        <HowToSchema name={`How MartPoint Works for ${industry.name}`} description={`Step-by-step workflow using MartPoint for ${industry.name}.`} steps={industry.solutions.map((s) => ({ name: s.title, text: s.desc }))} />
      </main>
      <Footer />
    </>
  )
}
