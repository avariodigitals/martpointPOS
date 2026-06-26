import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { OrganizationSchema } from "@/components/structured-data"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Building2, Target, Users, Globe, Lightbulb, Award } from "lucide-react"

export const metadata: Metadata = {
  title: "About Us — MartPoint by Avario Digitals",
  description:
    "Learn about Avario Digitals, the African technology company behind MartPoint Retail and MartPoint ERP. Built for African businesses, by Africans.",
  openGraph: {
    title: "About Us — MartPoint by Avario Digitals",
    description:
      "Learn about Avario Digitals, the African technology company behind MartPoint Retail and MartPoint ERP.",
  },
}

const values = [
  {
    icon: Target,
    title: "Purpose-Driven",
    description:
      "We build software that solves real problems for real businesses. Every feature is designed to help African retailers and enterprises grow.",
  },
  {
    icon: Lightbulb,
    title: "Innovation First",
    description:
      "From offline-first architecture to AI-powered assistants, we embrace technology that makes business operations simpler and smarter.",
  },
  {
    icon: Users,
    title: "Customer Obsessed",
    description:
      "Our customers are partners. We listen, iterate, and deliver based on feedback from supermarkets, pharmacies, restaurants and factories across Africa.",
  },
  {
    icon: Globe,
    title: "Built For Africa",
    description:
      "We understand the African business environment — from patchy internet to local payment methods. Our software is built to thrive here.",
  },
]

const milestones = [
  {
    year: "2019",
    title: "Avario Digitals Founded",
    description:
      "Avario Digitals was established with a mission to build technology solutions specifically for African businesses.",
  },
  {
    year: "2020",
    title: "MartPoint Retail Launched",
    description:
      "The first version of MartPoint Retail was released, focused on POS and inventory for small retail stores.",
  },
  {
    year: "2021",
    title: "Multi-Branch",
    description:
      "Added support for multiple branches , enabling businesses to operate anywhere in Africa.",
  },
  {
    year: "2022",
    title: "MartPoint ERP Released",
    description:
      "Launched MartPoint ERP to serve manufacturing, supermarkets, distribution, and enterprise clients with accounting, HR, and procurement modules.",
  },
  {
    year: "2024",
    title: "Expiry & MFG Date + End of Day Backup",
    description:
      "Added product expiry and manufacturing date tracking for regulated inventory. Introduced automated end-of-day backups to protect daily sales and stock records.",
  },
  {
    year: "2025",
    title: "Multiple Barcodes & QR Menu Codes",
    description:
      "Enabled support for multiple barcodes per product, ideal for bulk and unit pricing. Launched QR menu codes so restaurants and cafés let customers order directly from their tables.",
  },
  {
    year: "2026",
    title: "Online Store, WhatsApp, Offline, PayPlan, Attendance, Customer Verification & Loyalty",
    description:
      "Released the full retail suite: e-commerce storefronts, WhatsApp ordering and invoicing, reliable offline-first sales, PayPlan installment payments, staff attendance tracking, customer ID verification, and a loyalty rewards program to keep buyers coming back.",
  },
]

export default function AboutPage() {
  return (
    <>
      <OrganizationSchema />
      <Header />
      <main>
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                About Us
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                Technology Built For African Businesses
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                MartPoint is a product of <strong>Avario Digitals</strong>, an African technology company
                committed to building software that powers retail and enterprise operations across Africa.
              </p>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6">
                  The Story Behind MartPoint
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Avario Digitals was founded with a clear belief: African businesses deserve software
                    that understands their environment. Not imported tools that break when the internet
                    drops. Not expensive enterprise suites designed for markets halfway across the world.
                  </p>
                  <p>
                    MartPoint was born from conversations with shop owners, pharmacy managers, and
                    supermarket operators who needed one thing — a system that simply works the way they work.
                  </p>
                  <p>
                    Today, MartPoint powers hundreds of businesses across Africa. From single-store
                    retailers to multi-branch enterprises, our platform handles sales, inventory, payments,
                    staff, and customer relationships — online and offline.
                  </p>
                  <p>
                    We are not just a software vendor. We are a partner in your growth. Every update,
                    every feature, every line of code is written with African business realities in mind.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-retail" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Avario Digitals</h3>
                    <p className="text-sm text-muted-foreground">Product Owner & Developer</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Headquarters</p>
                      <p className="text-sm text-muted-foreground">Lagos, Africa</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Founded</p>
                      <p className="text-sm text-muted-foreground">2019</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Products</p>
                      <p className="text-sm text-muted-foreground">MartPoint Retail, MartPoint ERP</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Industries Served</p>
                      <p className="text-sm text-muted-foreground">
                        Retail, Supermarkets, Pharmacies, Restaurants, Fashion, Manufacturing
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                What Drives Us
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                The principles that guide every decision we make at Avario Digitals.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                    <v.icon className="w-6 h-6 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Our Journey
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Key milestones in the evolution of MartPoint and Avario Digitals.
              </p>
            </div>
            <div className="max-w-3xl mx-auto space-y-8">
              {milestones.map((m, i) => (
                <div key={m.year} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-retail text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>
                  <div className="pb-8">
                    <span className="text-sm font-semibold text-retail">{m.year}</span>
                    <h3 className="text-lg font-bold text-foreground mt-1">{m.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mt-1">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Ready To Work With Us?
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed">
                Whether you run a single store or a multi-branch enterprise, MartPoint is built to help you grow.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link
                    href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint.%20Can%20we%20talk%3F"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <Link href="/contact">Contact Us</Link>
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
