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
      </main>
      <Footer />
    </>
  )
}
