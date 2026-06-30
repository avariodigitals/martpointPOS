export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Star,
  Quote,
  TrendingUp,
  Clock,
  Package,
  Users,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Customer Stories — MartPoint Retail & Enterprise",
  description:
    "See how supermarkets, pharmacies, restaurants and retail chains across Africa use MartPoint to grow sales, reduce waste and take control of their operations.",
}

const featuredStory = {
  quote: "MartPoint transformed how we run our business. We now track stock in real time across two branches, checkout speed has doubled and our daily reports are ready before we close. It feels like we finally have a system built for how African retailers actually work.",
  author: "Adeola B.",
  role: "Owner, FreshMart Supermarket",
  industry: "Supermarkets",
  logo: "/trust/freshmart.webp",
  metrics: [
    { label: "Checkout Speed", value: "2x Faster", icon: Clock },
    { label: "Stock Accuracy", value: "98%+", icon: Package },
    { label: "Branches Managed", value: "2 Locations", icon: Users },
  ],
}

const stories = [
  {
    quote: "Offline mode keeps us selling even when the network is down. Our pharmacy never stopped operations, and the daily reports help us reorder before we run out.",
    author: "Dr. Emeka N.",
    role: "Manager, GreenLife Pharmacy",
    industry: "Pharmacies",
    logo: "/trust/greenlife.webp",
    result: "Zero stockouts of essential medicines in 6 months",
  },
  {
    quote: "Orders flow straight from the counter to the kitchen. Our wait times dropped and we can finally see which dishes sell best every day.",
    author: "Chioma O.",
    role: "Manager, Spice Kitchen Restaurant",
    industry: "Restaurants",
    logo: "/trust/spicekitchen.webp",
    result: "Wait times reduced by 50%",
  },
  {
    quote: "We used to overbuy because we never knew what sold. Now MartPoint tells us exactly which sizes and colours move fastest. Our stock turns faster and we barely have clearance sales.",
    author: "Fatima A.",
    role: "Owner, Luxe Fashion Boutique",
    industry: "Fashion",
    logo: "/trust/luxe.webp",
    result: "Dead stock reduced by 40%",
  },
  {
    quote: "We sell phones and laptops worth millions every month. Before MartPoint, we had no way to verify warranties. Now every unit is logged from day one. Warranty disputes dropped to almost zero.",
    author: "Ibrahim K.",
    role: "Director, TechWorld Electronics",
    industry: "Electronics",
    logo: "/trust/techworld.webp",
    result: "Warranty disputes down 95%",
  },
  {
    quote: "We run three grocery stores and MartPoint connects them all. I can check stock, sales and staff from anywhere without calling each branch. Adding our fourth store took one afternoon.",
    author: "Ngozi E.",
    role: "CEO, DailyNeeds Grocery Chain",
    industry: "Multi-Branch Retail",
    logo: "/trust/dailyneeds.webp",
    result: "4 locations managed from one dashboard",
  },
  {
    quote: "Our laundry runs on MartPoint. We track pickups, deliveries and payments from one place. No more lost receipts or missed orders.",
    author: "Tunde A.",
    role: "Founder, Clean Bubbles Laundry",
    industry: "Services",
    logo: "/trust/cleanbubbles.webp",
    result: "Order errors eliminated",
  },
]

const filters = ["All", "Supermarkets", "Pharmacies", "Restaurants", "Fashion", "Electronics", "Multi-Branch Retail"]

export default function CustomerStoriesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Success Stories
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Businesses Across Africa Are Growing With MartPoint
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                From single stores to multi-branch chains, MartPoint helps business owners take control of sales, stock and staff. These are their stories.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20want%20to%20become%20a%20MartPoint%20success%20story.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Become the Next Success Story
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

        {/* Featured Story */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border bg-background p-8 md:p-12">
                <div className="flex items-center gap-2 mb-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-[#fb8500] fill-[#fb8500]" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-retail/30 mb-4" />
                <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed mb-8">
                  &ldquo;{featuredStory.quote}&rdquo;
                </blockquote>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full bg-retail/10 overflow-hidden shrink-0">
                      <Image src={featuredStory.logo} alt={featuredStory.author} fill className="object-contain p-1" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{featuredStory.author}</div>
                      <div className="text-xs text-muted-foreground">{featuredStory.role}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {featuredStory.metrics.map((m) => (
                      <div key={m.label} className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                        <m.icon className="w-4 h-4 text-retail" />
                        <div>
                          <div className="text-sm font-bold text-foreground">{m.value}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Industry Filters */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="By Industry"
              headline="More Businesses Winning With MartPoint"
            />
            <div className="mt-8 flex flex-wrap gap-2 justify-center">
              {filters.map((f) => (
                <span
                  key={f}
                  className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    f === "All"
                      ? "bg-retail text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => (
                <div
                  key={story.author}
                  className="rounded-xl border border-border bg-card p-8 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-[#fb8500] fill-[#fb8500]" />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-retail/30 mb-2" />
                  <blockquote className="text-foreground leading-relaxed text-sm mb-6">
                    &ldquo;{story.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative w-10 h-10 rounded-full bg-retail/10 overflow-hidden shrink-0">
                      <Image src={story.logo} alt={story.author} fill className="object-contain p-1" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{story.author}</div>
                      <div className="text-xs text-muted-foreground">{story.role}</div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-retail-soft border border-retail-muted px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-retail" />
                      <span className="text-xs font-medium text-retail">{story.result}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Become a Story CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Your Business Could Be the Next Success Story
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join hundreds of African businesses using MartPoint to grow sales, cut waste and take control. Start today and see results within weeks.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20want%20to%20become%20a%20MartPoint%20success%20story.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
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
      </main>
      <Footer />
    </>
  )
}
