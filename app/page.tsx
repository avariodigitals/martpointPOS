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
  title: "MartPoint — #1 Retail & ERP Software for African Businesses",
  description:
    "All-in-one POS, inventory management, online store, WhatsApp ordering, loyalty rewards, and multi-branch management software built for African retail businesses. Supermarkets, pharmacies, restaurants, fashion stores & more.",
  keywords: [
    "POS software Nigeria", "POS software Africa", "retail software Nigeria",
    "inventory management software", "point of sale system Lagos",
    "supermarket software Nigeria", "pharmacy POS software",
    "restaurant POS system", "fashion store POS", "MartPoint POS",
    "multi-branch POS software", "offline POS system Nigeria",
    "WhatsApp ordering system", "online store Nigeria",
    "business management software Africa", "ERP software Nigeria",
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
    title: "MartPoint — #1 Retail & ERP Software for African Businesses",
    description:
      "All-in-one POS, inventory, online store, WhatsApp ordering, loyalty rewards & multi-branch management. Built for African retail businesses.",
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
