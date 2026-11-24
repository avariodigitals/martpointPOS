export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Hero } from "@/components/sections/hero"
import { TrustLayer } from "@/components/sections/trust-layer"
import { ProductSplit } from "@/components/sections/product-split"
import { PainPoints } from "@/components/sections/pain-points"
import { SolutionFramework } from "@/components/sections/solution-framework"
import { IndustryCoverage } from "@/components/sections/industry-coverage"
import { FeatureHighlights } from "@/components/sections/feature-highlights"
import { BusinessImpact } from "@/components/sections/business-impact"
import { DemoCTA } from "@/components/sections/demo-cta"
import { BlogPreview } from "@/components/sections/blog-preview"
import { PreFooterCTA } from "@/components/sections/pre-footer-cta"

export const metadata: Metadata = {
  title: {
    absolute: "MartPoint — Retail POS, Inventory & Growth Software in Nigeria",
  },
  description:
    "Run sales, inventory, online orders and customer growth from one retail platform. MartPoint brings POS, invoices, online card payments, SMS and email campaigns, automation and AI Ads together for African businesses.",
  keywords: [
    "POS software Nigeria", "POS software Africa", "retail software Nigeria",
    "inventory management software", "point of sale system Lagos",
    "supermarket software Nigeria", "pharmacy POS software",
    "restaurant POS system", "fashion store POS", "MartPoint POS",
    "multi-branch POS software", "offline POS system Nigeria",
    "WhatsApp ordering system", "online store Nigeria",
    "business management software Africa", "retail marketing software Nigeria",
    "SMS email marketing for retailers", "AI advertising for retail",
    "online invoice payment Nigeria", "invoice payment link",
    "retail management system", "stock management software",
    "best POS software Nigeria", "affordable POS system Africa",
    "inventory software in Nigeria", "inventory software for small business",
    "retail store inventory management software",
    "pharmacy inventory management system",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MartPoint — Retail POS, Inventory & Growth Software in Nigeria",
    description:
      "Connect retail operations and growth: POS, live inventory, online orders, invoice payments, customer campaigns, automation and AI Ads.",
    url: "https://martpoint.com.ng",
  },
}

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustLayer />
        <ProductSplit />
        <PainPoints />
        <SolutionFramework />
        <IndustryCoverage />
        <FeatureHighlights />
        <BusinessImpact />
        <DemoCTA />
        <BlogPreview />
        <PreFooterCTA />
      </main>
      <Footer />
    </>
  )
}
