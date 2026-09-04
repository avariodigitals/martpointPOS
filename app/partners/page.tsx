export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  ClipboardCheck,
  Cpu,
  CreditCard,
  LogIn,
  Search,
  Store,
  Users,
  HeartHandshake,
  Check,
  ChevronDown,
  Wrench,
  ShieldCheck,
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
  title: "Partner with MartPoint | Referral, Sales & Integration",
  description:
    "Explore MartPoint referral, channel, implementation, technology and payment partnerships. Learn how each model works and discuss becoming a partner.",
  alternates: {
    canonical: "/partners",
  },
}

const WHATSAPP_PARTNER =
  "https://wa.me/+2348036028069?text=Hi%2C%20I%27m%20interested%20in%20becoming%20a%20MartPoint%20partner.%20Can%20we%20talk%3F"
const EMAIL_PARTNER = "mailto:partners@martpoint.com.ng"

const partnerTypes = [
  {
    icon: Users,
    title: "Referral Partners",
    subtitle: null,
    description:
      "Introduce eligible businesses to MartPoint. Our team handles the sales process, software deployment and customer onboarding.",
    earn: "Commission on qualifying software purchases. Any renewal rewards are defined in your partner agreement.",
  },
  {
    icon: Store,
    title: "Channel Partners",
    subtitle: "Sales & Support",
    description:
      "Help businesses choose MartPoint, coordinate onboarding and provide agreed first-line usage guidance to assigned customers. MartPoint manages software invoicing, licensing and deployment.",
    earn: "Commission on qualifying software sales. Renewal commissions, where offered, follow the agreed terms and servicing responsibilities.",
  },
  {
    icon: Wrench,
    title: "Implementation Partners",
    subtitle: null,
    description:
      "Help assigned customers configure business information, prepare approved data imports, onboard users and complete training after MartPoint provisions the system.",
    earn: "Fees for approved implementation work. A separately approved customer referral may also qualify for a sales commission.",
  },
  {
    icon: Cpu,
    title: "Technology Partners",
    subtitle: null,
    description:
      "Connect compatible hardware, software or services with MartPoint through an agreed integration and technical review.",
    earn: "Commercial terms are agreed for the relevant product, development work or integration.",
  },
  {
    icon: CreditCard,
    title: "Payment Partners",
    subtitle: null,
    description:
      "Work with MartPoint to enable approved payment services through a reviewed technical and commercial arrangement.",
    earn: "Any payment-related fees, referral payments or revenue sharing are defined in a separate agreement.",
  },
]

const benefits = [
  {
    icon: ClipboardList,
    title: "Defined Responsibilities",
    desc: "Understand the activities covered by your approved partnership.",
  },
  {
    icon: Wallet,
    title: "Agreed Commercial Terms",
    desc: "Know how qualifying earnings, service fees and payment conditions apply to your role.",
  },
  {
    icon: UserCheck,
    title: "Relevant Onboarding",
    desc: "Receive guidance appropriate to your approved partnership activities.",
  },
  {
    icon: ShieldCheck,
    title: "Approved Product Information",
    desc: "Use accurate product and sales information when introducing MartPoint to customers.",
  },
  {
    icon: HeadphonesIcon,
    title: "Coordinated Support",
    desc: "Work with MartPoint on customer issues within your agreed responsibilities.",
  },
  {
    icon: BarChart3,
    title: "Opportunities to Grow",
    desc: "Further collaboration may be considered based on customer needs, partner capability and performance.",
  },
]

const martpointManages = [
  "Software licensing and subscriptions",
  "Software invoicing, collections and renewals",
  "Platform provisioning, deployment and hosting",
  "Platform maintenance and technical software support",
  "Partner approval and authorisation of customer access",
]

const partnersMayProvide = [
  "Customer introductions and sales assistance",
  "Agreed first-line usage guidance",
  "Assigned business configuration and onboarding",
  "Separately scoped implementation and training",
  "Approved technology or payment integrations",
]

const process = [
  {
    step: "01",
    title: "Contact Us",
    desc: "Tell us about your business, experience, location and preferred partnership type.",
  },
  {
    step: "02",
    title: "Review",
    desc: "We assess the proposed partnership and may request further information or a discussion.",
  },
  {
    step: "03",
    title: "Agree Terms",
    desc: "We define the approved role, responsibilities and applicable commercial terms.",
  },
  {
    step: "04",
    title: "Complete Onboarding",
    desc: "Complete any guidance, training or technical checks required for your role.",
  },
  {
    step: "05",
    title: "Begin Approved Activities",
    desc: "Start working with MartPoint once your partnership is approved and activated.",
  },
]

const whoShouldPartner = [
  { icon: ClipboardList, title: "Business Consultants", desc: "Advisers who help businesses improve operations and select suitable business software." },
  { icon: Monitor, title: "Digital Agencies", desc: "Agencies that want to introduce MartPoint or provide approved customer onboarding services." },
  { icon: UserCheck, title: "IT Consultants", desc: "Professionals who help businesses adopt and use technology." },
  { icon: ShoppingBag, title: "POS Hardware Resellers", desc: "Businesses supplying retail equipment that can introduce customers to MartPoint." },
  { icon: BarChart3, title: "ERP Consultants", desc: "Consultants with experience in inventory, accounting and business processes." },
  { icon: Cpu, title: "Technology Companies", desc: "Vendors proposing compatible software, hardware or integrations." },
  { icon: CreditCard, title: "Payment Providers", desc: "Providers proposing payment services for review and integration." },
  { icon: Server, title: "Managed Service Providers", desc: "Businesses supporting customer technology environments and seeking an approved MartPoint role." },
]

const faqs = [
  { q: "How do I become a MartPoint partner?", a: "Contact us through WhatsApp or email with your business details and preferred partnership type. We will explain the application requirements and relevant next steps." },
  { q: "Is there a fee to apply?", a: "There is no upfront fee to apply to become a MartPoint partner. Any separately chargeable products or services will be disclosed and agreed in advance." },
  { q: "Do partners receive discounted licenses or commissions?", a: "Referral and channel partnerships use commissions on qualifying software sales under agreed terms. Implementation work and technology or payment arrangements have separate commercial terms. Partner approval does not automatically provide discounted licenses." },
  { q: "Are commissions paid on renewals?", a: "Renewal commissions are not automatic. Where offered, the eligible period, rate and any ongoing responsibilities are stated in the partner agreement." },
  { q: "Who invoices customers for MartPoint software?", a: "MartPoint issues software invoices and manages software payments, licensing and renewals. Customers should pay through the official payment instructions provided by MartPoint." },
  { q: "When are commissions paid?", a: "Eligible commissions are calculated monthly and paid within 14 days after the relevant month-end. The partner agreement defines eligibility, any applicable holding period and how refunds or payment reversals are handled." },
  { q: "Can implementation partners charge for their work?", a: "Implementation work may carry a separately agreed fee. The scope, price, invoicing arrangements and delivery responsibilities must be clear before work begins. Customers must not be charged twice for onboarding or training already included in their purchased package." },
  { q: "Can partners host, deploy or customise MartPoint independently?", a: "No. MartPoint manages platform hosting and deployment. Approved partners may assist with authorised configuration and onboarding. Custom development and integrations require separate review and approval." },
  { q: "How do partners work with customer accounts?", a: "Customers control their business accounts, while MartPoint manages the software subscription. An approved partner may act as an assigned sales or service contact. Any account access is limited to authorised activities, and customers can contact MartPoint directly." },
  { q: "Do partners receive training?", a: "Partners receive onboarding appropriate to their approved role. Additional training or technical assessment may be required before certain activities or customer access are authorised." },
  { q: "Can technology companies and payment providers integrate with MartPoint?", a: "Proposed integrations are reviewed for technical fit, security, support requirements and commercial viability. Available documentation, testing arrangements and implementation requirements are discussed during the review." },
  { q: "Can I apply from outside Nigeria?", a: "You may express interest from outside Nigeria. Approval depends on product availability, support coverage and the requirements of the proposed market. Contact MartPoint to discuss your location." },
  { q: "Does applying make me an authorised MartPoint partner?", a: "No. You may represent yourself as an authorised partner only after approval and activation, and only for the activities covered by your agreement." },
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
                Grow Your Business with MartPoint
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Introduce businesses to MartPoint, help customers get started, support their operations or integrate your technology. Explore a partnership that matches your expertise, with clear responsibilities and agreed commercial terms.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="/partners/apply">
                    Become a Partner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={WHATSAPP_PARTNER} target="_blank" rel="noopener noreferrer">
                    Discuss Becoming a Partner
                  </Link>
                </Button>
              </div>

              {/* Existing partner quick actions */}
              <div className="mt-12 pt-8 border-t border-border/60">
                <p className="text-sm text-muted-foreground mb-5">
                  Already connected to MartPoint?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <Link
                    href="/partner/login"
                    className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center">
                      <LogIn className="w-5 h-5 text-retail" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                        Partner Login
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Access your portal
                      </span>
                    </div>
                  </Link>
                  <Link
                    href="/partners/application-status"
                    className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-retail" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                        Check Application Status
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Track with your reference
                      </span>
                    </div>
                  </Link>
                  <Link
                    href="/partners/directory"
                    className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center">
                      <Search className="w-5 h-5 text-retail" />
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                        Find or Verify a Partner
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        Browse approved partners
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Partnership Types */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Partnership Types"
              headline="Choose How You Partner with MartPoint"
              description="Your approved partnership type determines your responsibilities and earning model. You may discuss more than one type with us, with each assessed separately."
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5 max-w-5xl mx-auto">
              {partnerTypes.map((type, i) => (
                <div key={type.title} className={`rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm flex flex-col lg:col-span-2 ${i === 3 ? "lg:col-start-2" : ""}`}>
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <type.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{type.title}</h3>
                  {type.subtitle && (
                    <span className="text-xs font-semibold uppercase tracking-widest text-retail mt-1 mb-2">
                      {type.subtitle}
                    </span>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">{type.description}</p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                      How you earn
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">{type.earn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Partner Benefits */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Partner Benefits"
              headline="A Clear Framework for Working Together"
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <benefit.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Responsibilities */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Responsibilities"
              headline="How MartPoint and Partners Work Together"
              description="MartPoint operates and maintains the software platform. Partners contribute within their approved roles."
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <div className="rounded-xl border border-border bg-background p-6 md:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">MartPoint Manages</h3>
                </div>
                <ul className="space-y-3">
                  {martpointManages.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-background p-6 md:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Approved Partners May Provide</h3>
                </div>
                <ul className="space-y-3">
                  {partnersMayProvide.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 max-w-3xl mx-auto text-center text-sm text-muted-foreground leading-relaxed">
              Partner approval does not grant unrestricted customer access. Access is limited to assigned customers and authorised activities. Partners may not independently host, deploy or make unapproved modifications to MartPoint.
            </p>
          </div>
        </section>

        {/* Partnership Process */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How It Works"
              headline="How Partnership Begins"
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
            <p className="mt-10 max-w-3xl mx-auto text-center text-sm text-muted-foreground leading-relaxed">
              An enquiry or application does not confer approved partner status. Review and onboarding times depend on the partnership type and the information required.
            </p>
          </div>
        </section>

        {/* Who Should Apply */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Who Should Apply"
              headline="Who Can Partner with MartPoint?"
              description="We welcome enquiries from businesses and professionals who can help customers discover, adopt or extend MartPoint. Approval depends on the proposed role, relevant capabilities and our operational coverage."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {whoShouldPartner.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
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
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline="Frequently Asked Questions"
            />
            <div className="mt-10 space-y-4">
              {faqs.map((faq, i) => (
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

        {/* Bottom CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Find the Right Partnership for Your Business
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Tell us what you do and how you would like to work with MartPoint. Contact our team to discuss the right partnership and next steps.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="/partners/apply">
                    Become a Partner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={WHATSAPP_PARTNER} target="_blank" rel="noopener noreferrer">
                    Discuss Becoming a Partner
                  </Link>
                </Button>
              </div>

              {/* Existing partner quick links */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <Link
                  href="/partner/login"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                    <LogIn className="w-5 h-5 text-retail" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                      Partner Login
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Access your portal
                    </span>
                  </div>
                </Link>
                <Link
                  href="/partners/application-status"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-retail" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                      Check Application Status
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Track with your reference
                    </span>
                  </div>
                </Link>
                <Link
                  href="/partners/directory"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition-all hover:border-retail/40 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                    <Search className="w-5 h-5 text-retail" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-foreground group-hover:text-retail transition-colors">
                      Find or Verify a Partner
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Browse approved partners
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
