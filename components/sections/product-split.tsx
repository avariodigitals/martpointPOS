import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import {
  ShoppingCart,
  Package,
  Receipt,
  Store,
  Calculator,
  Users,
  FileCheck,
  Building2,
  ArrowRight,
} from "lucide-react"

const retailFeatures = [
  { icon: ShoppingCart, label: "Point of Sale" },
  { icon: Package, label: "Inventory" },
  { icon: Receipt, label: "Receipts & Payments" },
  { icon: Store, label: "Multi-Branch" },
]

const erpFeatures = [
  { icon: Calculator, label: "Accounting" },
  { icon: Users, label: "HR & CRM" },
  { icon: FileCheck, label: "Approvals" },
  { icon: Building2, label: "Operations" },
]

export function ProductSplit() {
  return (
    <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="Products"
          headline="Two solutions. One ecosystem. Built for different jobs."
          description="Choose the product that matches where your business is today. You can always grow into the other."
        />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Retail Card */}
          <div className="group relative rounded-2xl border border-retail-muted bg-retail-soft p-8 md:p-10 transition-all duration-300 hover:shadow-lg hover:border-retail/30">
            <div className="absolute left-0 top-8 bottom-8 w-1 rounded-r bg-retail" />

            <div className="mb-6">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-2">
                For Store Operations
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                MartPoint Retail
              </h3>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              Retail management software for supermarkets, pharmacies,
              restaurants, and fashion stores. Handle sales, track inventory,
              manage cashiers, and monitor every branch from one place.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {retailFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2.5"
                >
                  <feature.icon className="w-4 h-4 text-retail shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ideal for
              </span>
              <p className="text-sm text-foreground mt-1">
                Supermarkets, Mini Marts, Restaurants, Pharmacies, Fashion
                Stores, Electronics Stores
              </p>
            </div>

            <Button
              asChild
              variant="retail"
              className="w-full sm:w-auto"
            >
              <Link href="/martpoint-retail">
                Explore Retail
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* ERP Card */}
          <div className="group relative rounded-2xl border border-erp-muted bg-erp-soft p-8 md:p-10 transition-all duration-300 hover:shadow-lg hover:border-erp/30">
            <div className="absolute left-0 top-8 bottom-8 w-1 rounded-r bg-erp" />

            <div className="mb-6">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-erp mb-2">
                For Business Management
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                MartPoint ERP
              </h3>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              Enterprise business software for distributors, wholesalers, and
              multi-branch operations. Accounting, procurement, HR, CRM,
              approvals, and reporting — connected.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {erpFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2.5"
                >
                  <feature.icon className="w-4 h-4 text-erp shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ideal for
              </span>
              <p className="text-sm text-foreground mt-1">
                Distributors, Wholesalers, Multi-Branch Businesses, SMEs with
                finance teams
              </p>
            </div>

            <Button
              asChild
              variant="erp"
              className="w-full sm:w-auto"
            >
              <Link href="/martpoint-erp">
                Explore ERP
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
