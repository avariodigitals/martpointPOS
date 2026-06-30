export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import {
  allIndustries,
  industriesByCategory,
  categoryOrder,
} from "@/lib/industries"

export const metadata: Metadata = {
  title: "Industries We Serve",
  description:
    "MartPoint software for supermarkets, restaurants, pharmacies, electronics, fashion, distributors, and 30+ more industries.",
}

export default function IndustriesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <SectionHeader
              label="Industries"
              headline="Built for the businesses that power Africa"
              description={`Whatever you sell or distribute, MartPoint is designed for your operational reality. ${allIndustries.length}+ industries covered.`}
            />
          </div>
        </section>

        <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
          <div className="container-martpoint space-y-24">
            {categoryOrder
              .filter((cat) => industriesByCategory[cat]?.length > 0)
              .map((category) => (
                <div key={category} className="pb-4">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {industriesByCategory[category].map((industry) => (
                      <div
                        key={industry.slug}
                        className="group rounded-2xl border border-border bg-background p-8 transition-all duration-200 hover:shadow-sm hover:border-retail/20"
                      >
                        <h3 className="text-lg font-bold text-foreground mb-3">
                          {industry.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                          {industry.description}
                        </p>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="px-0 h-auto"
                        >
                          <Link href={`/industries/${industry.slug}`}>
                            Learn more
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
