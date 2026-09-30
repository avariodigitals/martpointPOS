import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import {
  ShoppingCart,
  Package,
  Receipt,
  Store,
  WifiOff,
  Printer,
  Building2,
  HardDrive,
  ArrowRight,
} from "lucide-react"

const cloudFeatures = [
  { icon: ShoppingCart, label: "Point of Sale" },
  { icon: Package, label: "Inventory" },
  { icon: Receipt, label: "Receipts & Payments" },
  { icon: Store, label: "Multi-Branch" },
]

const offlineFeatures = [
  { icon: WifiOff, label: "Works Without Internet" },
  { icon: Printer, label: "Receipt Printing" },
  { icon: HardDrive, label: "Local Installation" },
  { icon: Building2, label: "LAN Multi-Branch" },
]

export function ProductSplit() {
  return (
    <section id="features" className="w-full bg-muted py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="Products"
          headline="MartPoint Retail. Two ways to run it."
          description="Same retail platform — in the cloud, or installed locally where internet is unreliable."
        />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Retail Cloud Card */}
          <div className="group relative rounded-2xl border border-retail-muted bg-retail-soft p-8 md:p-10 transition-all duration-300 hover:shadow-lg hover:border-retail/30 text-center md:text-left">
            <div className="absolute left-0 top-8 bottom-8 w-1 rounded-r bg-retail hidden md:block" />

            <div className="mb-6">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-2">
                Cloud Subscription
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                MartPoint Retail Cloud
              </h3>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              Retail management software for supermarkets, pharmacies,
              restaurants, and fashion stores. Handle sales, track inventory,
              manage cashiers, and monitor every branch from one place —
              with your online store included.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {cloudFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2.5 justify-center md:justify-start"
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
              className="w-full sm:w-auto mx-auto md:mx-0"
            >
              <Link href="/martpoint-retail">
                Explore Retail Cloud
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <div className="mt-4">
              <Button asChild variant="default" className="w-full sm:w-auto mx-auto md:mx-0">
                <Link href="/pricing">
                  Start From ₦99,999/Year
                </Link>
              </Button>
            </div>
          </div>

          {/* Retail Offline Card */}
          <div className="group relative rounded-2xl border border-retail-muted bg-retail-soft p-8 md:p-10 transition-all duration-300 hover:shadow-lg hover:border-retail/30 text-center md:text-left">
            <div className="absolute left-0 top-8 bottom-8 w-1 rounded-r bg-retail hidden md:block" />

            <div className="mb-6">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-2">
                One-Time Licence
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                MartPoint Retail Offline
              </h3>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-8">
              The full retail system installed locally on your own hardware.
              Keep selling, printing receipts and managing stock with no
              internet connection — ideal where connectivity is unreliable.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {offlineFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 bg-white/60 rounded-lg px-3 py-2.5 justify-center md:justify-start"
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
                Stores with unreliable internet, single-location shops, and
                businesses that prefer a locally installed system
              </p>
            </div>

            <Button
              asChild
              variant="retail"
              className="w-full sm:w-auto mx-auto md:mx-0"
            >
              <Link href="/pricing">
                See Offline Pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <div className="mt-4">
              <Button asChild variant="default" className="w-full sm:w-auto mx-auto md:mx-0">
                <Link href="/pricing">
                  ₦250,000 One-Time Licence
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
