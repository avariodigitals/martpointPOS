import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, ChevronDown } from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"
import { IndustryPricing } from "@/components/industries/industry-pricing"
import { LeafSprig, LeafBullet } from "@/components/industries/botanical-accents"
import type { IndustryData } from "@/lib/industries"

interface IndustryPageProps {
  industry: IndustryData
}

export function IndustryPage({ industry }: IndustryPageProps) {
  const labelColor = industry.product === "retail" ? "text-retail" : "text-erp"
  const waHref = `https://wa.me/+2348037978230?text=${encodeURIComponent(industry.hero.waQuery)}`
  const e = industry.enhanced

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full bg-background border-b border-border overflow-hidden">
          {e ? (
            <>
              <LeafSprig className="pointer-events-none absolute -top-8 -left-10 h-56 w-56 text-[#1F7A4D]/15 md:h-72 md:w-72" />
              <LeafSprig className="pointer-events-none absolute -bottom-10 -right-8 h-48 w-48 rotate-[18deg] text-[#1F7A4D]/10 md:h-64 md:w-64" />
            </>
          ) : null}
          <div className="container-martpoint relative py-16 md:py-24 lg:py-32">
            <div className={`mx-auto text-center ${e ? "max-w-4xl" : "max-w-3xl"}`}>
              <span className={`inline-block text-xs font-semibold uppercase tracking-widest mb-4 ${labelColor}`}>
                {industry.hero.label}
              </span>
              {e ? <span className="mx-auto mb-5 block h-px w-16 bg-[#1F7A4D]/40" /> : null}
              <h1
                className={`font-extrabold tracking-tight text-foreground ${
                  e
                    ? "text-4xl md:text-5xl lg:text-[3.4rem] leading-[1.1] text-balance"
                    : "text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.05]"
                }`}
              >
                {industry.hero.headline}
              </h1>
              <p
                className={`mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed ${
                  e ? "max-w-3xl mx-auto text-pretty" : "max-w-2xl mx-auto"
                }`}
              >
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
                  <p className={e ? "text-xs text-white/75 leading-relaxed" : "text-xs text-white/60 leading-relaxed"}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Revenue streams — rendered only for industries that supply them */}
        {e ? (
          <section className="w-full bg-background py-20 md:py-28">
            <div className="container-martpoint">
              <SectionHeader
                label="Your Revenue Streams"
                headline={e.revenueStreams.headline}
                description={e.revenueStreams.intro}
              />
              <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {e.revenueStreams.items.map((stream) => (
                  <div
                    key={stream.title}
                    className="relative rounded-2xl border border-border bg-card p-7 md:p-8 overflow-hidden"
                  >
                    <LeafSprig className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 text-[#1F7A4D]/10" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#1F7A4D]/10 flex items-center justify-center shrink-0">
                        <stream.icon className="w-5 h-5 text-[#1F7A4D]" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{stream.title}</h3>
                    </div>
                    <p className="relative mt-4 text-sm md:text-base leading-relaxed text-muted-foreground">
                      {stream.desc}
                    </p>
                    <ul className="relative mt-5 space-y-2.5">
                      {stream.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90">
                          <LeafBullet className="w-4 h-4 text-[#1F7A4D] mt-0.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

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

        {/* Online store deep-dive — enhanced pages only */}
        {e ? (
          <section className="w-full bg-background py-20 md:py-28 border-t border-border">
            <div className="container-martpoint">
              <SectionHeader
                label="Online Store"
                headline={e.storefront.headline}
                description={e.storefront.intro}
              />
              <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 max-w-6xl mx-auto items-start">
                <ul className="lg:col-span-5 space-y-6">
                  {e.storefront.items.map((item) => (
                    <li key={item.title} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-retail/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-retail" />
                      </div>
                      <div>
                        <p className="text-sm md:text-[15px] font-semibold text-foreground mb-1">{item.title}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="lg:col-span-7 space-y-6">
                  {e.storefront.screenshots.map((shot) => (
                    <figure key={shot.src} className="rounded-2xl border border-border bg-card p-3 md:p-4">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                        <Image
                          src={shot.src}
                          alt={shot.alt}
                          fill
                          sizes="(max-width: 1024px) 100vw, 760px"
                          className="object-contain"
                        />
                      </div>
                      <figcaption className="px-1 pt-3 pb-1 text-xs md:text-sm leading-relaxed text-muted-foreground">
                        {shot.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
              <p className="mt-12 max-w-4xl mx-auto rounded-xl border border-border bg-muted px-5 py-4 text-xs md:text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{e.storefront.notIncluded.label}:</span>{" "}
                {e.storefront.notIncluded.body}
              </p>
            </div>
          </section>
        ) : null}

        {/* Step workflow — enhanced pages only */}
        {e ? (
          <section className="w-full bg-muted py-20 md:py-28">
            <div className="container-martpoint">
              <SectionHeader
                label="How A Job Runs"
                headline={e.workflow.headline}
                description={e.workflow.intro}
              />
              <div className="mt-14 max-w-5xl mx-auto" aria-hidden="true">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#1F7A4D]/25" />
                  <LeafSprig className="h-6 w-6 text-[#1F7A4D]/70" />
                  <span className="h-px flex-1 bg-[#1F7A4D]/25" />
                </div>
              </div>
              <ol className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {e.workflow.steps.map((step, i) => (
                  <li key={step.title} className="relative rounded-2xl border border-border bg-background p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="w-8 h-8 rounded-full bg-retail text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <step.icon className="w-5 h-5 text-[#1F7A4D]" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                    {i < e.workflow.steps.length - 1 && (i + 1) % 3 !== 0 ? (
                      <ArrowRight
                        className="hidden lg:block absolute -right-4 top-1/2 h-5 w-5 text-retail/30"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="mt-10 max-w-4xl mx-auto rounded-xl border border-[#1F7A4D]/25 bg-[#1F7A4D]/5 px-5 py-4 text-xs md:text-sm leading-relaxed text-foreground/80">
                {e.workflow.footnote}
              </p>
            </div>
          </section>
        ) : null}

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
              <div className={e ? "space-y-5" : "space-y-4"}>
                {industry.whyMartPoint.map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                    <span className={`text-foreground ${e ? "text-[15px] md:text-base leading-relaxed text-pretty" : ""}`}>{text}</span>
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
                <details key={i} className={`group rounded-xl border border-border bg-background cursor-pointer ${e ? "p-6" : "p-5"}`}>
                  <summary className="flex items-center justify-between gap-4 list-none">
                    <span className={`font-semibold text-foreground ${e ? "text-[15px] leading-snug" : "text-sm"}`}>{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className={`text-muted-foreground leading-relaxed ${e ? "mt-4 text-[15px] text-pretty" : "mt-3 text-sm"}`}>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing — retail only; ERP stays quote-only */}
        {industry.product === "retail" ? (
          <IndustryPricing industryName={industry.name} tone="background" />
        ) : null}

        {/* CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                See What MartPoint Can Do For {industry.name}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Use MartPoint to sell more, waste less and make confident decisions with real business intelligence.
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
