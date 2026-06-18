import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Industries We Serve",
  description:
    "MartPoint software for supermarkets, restaurants, pharmacies, electronics, fashion, distributors, and wholesalers.",
}

const industries = [
  {
    name: "Supermarkets",
    description:
      "Manage thousands of SKUs, fast checkout lanes, and multiple branches with real-time stock visibility.",
    product: "retail",
  },
  {
    name: "Mini Marts",
    description:
      "Track daily sales, monitor fast-moving items, and reorder before you run out of stock.",
    product: "retail",
  },
  {
    name: "Restaurants",
    description:
      "Handle table orders, kitchen tickets, split payments, and track ingredient inventory per outlet.",
    product: "retail",
  },
  {
    name: "Pharmacies",
    description:
      "Manage batch tracking, expiry dates, prescription sales, and regulated inventory with full audit trails.",
    product: "retail",
  },
  {
    name: "Electronics Stores",
    description:
      "Track serial numbers, warranty periods, and high-value stock across showroom and warehouse.",
    product: "retail",
  },
  {
    name: "Fashion Retailers",
    description:
      "Manage sizes, colors, seasons, and styles. See what sells by branch and optimize your stock mix.",
    product: "retail",
  },
  {
    name: "Distributors",
    description:
      "Coordinate large orders, manage delivery routes, track credit sales, and monitor warehouse operations.",
    product: "erp",
  },
  {
    name: "Wholesalers",
    description:
      "Handle bulk pricing tiers, multi-customer invoicing, and stock transfers between depots.",
    product: "erp",
  },
]

export default function IndustriesPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <SectionHeader
              label="Industries"
              headline="Built for the businesses that power Nigeria"
              description="Whatever you sell or distribute, MartPoint is designed for your operational reality."
            />
          </div>
        </section>

        <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {industries.map((industry) => (
                <div
                  key={industry.name}
                  className="group rounded-2xl border border-border bg-background p-8 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        industry.product === "retail"
                          ? "bg-retail"
                          : "bg-erp"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        industry.product === "retail"
                          ? "text-retail"
                          : "text-erp"
                      }`}
                    >
                      {industry.product === "retail"
                        ? "MartPoint Retail"
                        : "MartPoint ERP"}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {industry.name}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {industry.description}
                  </p>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="px-0 h-auto"
                  >
                    <Link
                      href={
                        industry.product === "retail"
                          ? "/martpoint-retail"
                          : "/martpoint-erp"
                      }
                    >
                      Learn more
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
