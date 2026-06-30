export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  Cpu,
  CreditCard,
  Store,
  Users,
  HeartHandshake,
  Check,
  ChevronDown,
  Wrench,
  Cloud,
  ShieldCheck,
  Zap,
  HeadphonesIcon,
  Monitor,
  UserCheck,
  ShoppingBag,
  BarChart3,
  Wallet,
  ClipboardList,
  Server,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Partners — MartPoint Partner Programme",
  description:
    "Join the MartPoint partner network. Technology, payment, channel, implementation and referral partnerships for companies helping African businesses grow.",
}

const partnerTypes = [
  {
    icon: Cpu,
    title: "Technology Partners",
    description: "Integrate your hardware, software or platform with MartPoint. We welcome POS device makers, accounting tools and e-commerce platforms.",
  },
  {
    icon: CreditCard,
    title: "Payment Partners",
    description: "Enable your payment solution inside MartPoint Retail and Enterprise. Reach businesses transacting across Africa every day.",
  },
  {
    icon: Store,
    title: "Channel Partners",
    description: "Resell MartPoint to your retail, pharmacy or restaurant clients. Earn commissions and provide first-line support.",
  },
  {
    icon: Users,
    title: "Referral Partners",
    description: "Refer businesses to MartPoint and earn recurring rewards. No technical knowledge required. Just make the introduction.",
  },
  {
    icon: Wrench,
    title: "Implementation Partners",
    description: "For digital agencies, IT companies, consultants and system integrators who deploy, customise, onboard and support MartPoint for customers.",
  },
]

const benefits = [
  "Revenue share on every deal you refer, resell or implement",
  "Qualified lead sharing with active partner territories",
  "Structured partner training and official certification programme",
  "Technical support and integration documentation",
  "Early access to new products, APIs and beta features",
  "Dedicated partner success manager for strategic accounts",
  "Co-marketing opportunities including joint events and case studies",
]

const trustCards = [
  { icon: Cloud, title: "Cloud-First Platform", desc: "Built for reliability, scale and continuous deployment across African markets." },
  { icon: ShieldCheck, title: "Enterprise Ready", desc: "Security, permissions, audit trails and compliance features built in from day one." },
  { icon: Zap, title: "Growing Ecosystem", desc: "An expanding network of integrations, partners and connected services." },
  { icon: HeadphonesIcon, title: "Partner-First Support", desc: "Direct access to our partner team for technical and commercial guidance." },
]

const process = [
  { step: "01", title: "Apply", desc: "Fill out the partner application. We review within 3 business days." },
  { step: "02", title: "Meet", desc: "Discovery call to align goals, define the partnership model and set expectations." },
  { step: "03", title: "Onboard", desc: "Technical integration, team training and co-marketing setup where needed." },
  { step: "04", title: "Grow", desc: "Start referring, reselling or integrating. Track progress in your partner dashboard." },
  { step: "05", title: "Scale", desc: "Successful partners receive continuous enablement, product updates, sales support and expansion opportunities." },
]

const whoShouldPartner = [
  { icon: Monitor, title: "Technology Companies", desc: "Software vendors, hardware manufacturers and API platforms looking to extend into African retail and ERP." },
  { icon: Wrench, title: "Digital Agencies", desc: "Agencies that build websites, run digital marketing and want to offer POS or ERP as part of their stack." },
  { icon: UserCheck, title: "IT Consultants", desc: "Independent and firm-based consultants who advise businesses on operational technology." },
  { icon: ShoppingBag, title: "POS Resellers", desc: "Hardware resellers and systems integrators who already sell POS equipment and want to add software revenue." },
  { icon: BarChart3, title: "ERP Consultants", desc: "Consultants specialising in inventory, accounting and enterprise process improvement." },
  { icon: Wallet, title: "Payment Providers", desc: "Fintechs, banks and mobile money operators wanting to embed payments inside MartPoint." },
  { icon: ClipboardList, title: "Business Consultants", desc: "Advisors who help retailers and distributors improve operations and can recommend MartPoint." },
  { icon: Server, title: "Managed Service Providers", desc: "MSPs who manage IT infrastructure for client businesses and want to include business software." },
]

const faqs = [
  { q: "How do I become a partner?", a: "Start by filling out the partner application or messaging us on WhatsApp. We schedule a discovery call within 3 business days to understand your business and recommend the right partnership tier." },
  { q: "Is there a cost to join?", a: "No. There is no upfront fee to become a MartPoint partner. Some tiers require certification training, which we provide at no cost." },
  { q: "How are commissions paid?", a: "Commissions are calculated monthly and paid within 14 days of the close of each month. You track every deal in your partner dashboard." },
  { q: "Who owns the customer relationship?", a: "Channel and implementation partners typically own the end-customer relationship. Referral partners hand the relationship to MartPoint after introduction. We are flexible." },
  { q: "Do partners receive training?", a: "Yes. Every partner receives onboarding training. Implementation and channel partners go through a structured certification programme with live sessions and documentation." },
  { q: "Can agencies implement MartPoint for clients?", a: "Absolutely. Our Implementation Partner programme is designed for agencies and consultants who want to deploy, customise and support MartPoint as a service." },
  { q: "Do payment providers integrate directly?", a: "Yes. We provide API documentation and a sandbox environment. Our engineering team supports integration and testing before go-live." },
  { q: "How long does approval take?", a: "Most applications are reviewed within 3 business days. Complex technology integrations may take up to 7 days for technical evaluation." },
  { q: "Can I operate outside Nigeria?", a: "Yes. We actively welcome partners across Africa. MartPoint is built for multi-currency, multi-country operations." },
  { q: "Can I resell MartPoint?", a: "Yes. Our Channel Partner programme lets you resell MartPoint Retail and Enterprise with margin, training and sales support included." },
]

export default function PartnersPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Partner Programme
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Build the Future of African Commerce With MartPoint
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                MartPoint is building an ecosystem of implementation partners, technology companies, consultants, payment providers and resellers helping African businesses modernise their operations. Partner with us and grow together.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%27m%20interested%20in%20becoming%20a%20MartPoint%20partner.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Become a Partner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="mailto:hello@martpoint.com.ng">Email Us</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Partner Types */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Partnership Models"
              headline="How You Can Partner With MartPoint"
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {partnerTypes.map((type) => (
                <div key={type.title} className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <type.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{type.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                  Partner Benefits
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Why Partners Choose MartPoint
                </h2>
                <div className="mt-8 space-y-5">
                  {benefits.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trustCards.map((card) => (
                  <div key={card.title} className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                    <card.icon className="w-8 h-8 text-retail mx-auto mb-3" />
                    <div className="text-sm font-bold text-foreground mb-1">{card.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{card.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How It Works"
              headline="Partnership Process"
              description="From application to first deal in under two weeks."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {process.map((step) => (
                <div key={step.step} className="relative">
                  <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm mb-4">
                    {step.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who Should Partner */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Who Should Apply"
              headline="Who Should Become a MartPoint Partner?"
              description="Our partner programmes are designed for businesses and professionals who serve African retailers, distributors and manufacturers."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {whoShouldPartner.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline="Questions Partners Ask"
            />
            <div className="mt-10 space-y-4">
              {faqs.map((faq, i) => (
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
                Let's Build Better Business Software Together
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Become part of the MartPoint partner network. Whether you integrate, implement, refer or resell, we will give you the tools, training and support to succeed.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%27m%20interested%20in%20becoming%20a%20MartPoint%20partner.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Become a Partner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="mailto:hello@martpoint.com.ng">Email Us</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
