import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, TrendingUp, ShoppingCart, BarChart3, Boxes } from "lucide-react"

function BusinessVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0">
      <div className="relative bg-muted rounded-2xl p-6 md:p-8 border border-border">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-retail-soft flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-retail" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales</span>
            </div>
            <div className="text-2xl font-bold text-foreground">₦2.4M</div>
            <div className="text-xs text-muted-foreground mt-1">Today&apos;s revenue</div>
            <div className="flex items-center gap-1 mt-2 text-success text-xs font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>+18%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-erp-soft flex items-center justify-center">
                <Boxes className="w-4 h-4 text-erp" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</span>
            </div>
            <div className="text-2xl font-bold text-foreground">1,247</div>
            <div className="text-xs text-muted-foreground mt-1">Items in stock</div>
            <div className="flex items-center gap-1 mt-2 text-destructive text-xs font-medium">
              <span>12 low stock alerts</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-border shadow-sm col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operations</span>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-lg font-bold text-foreground">8</div>
                <div className="text-xs text-muted-foreground">Branches</div>
              </div>
              <div className="w-px bg-border" />
              <div>
                <div className="text-lg font-bold text-foreground">42</div>
                <div className="text-xs text-muted-foreground">Staff</div>
              </div>
              <div className="w-px bg-border" />
              <div>
                <div className="text-lg font-bold text-foreground">3,891</div>
                <div className="text-xs text-muted-foreground">Transactions</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -top-3 -right-3 w-20 h-20 bg-retail/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-3 -left-3 w-20 h-20 bg-erp/10 rounded-full blur-2xl" />
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-background">
      <div className="container-martpoint py-16 md:py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
              Run your business with{" "}
              <span className="text-retail">clarity</span>,{" "}
              <span className="text-erp">control</span>, and{" "}
              <span className="text-accent">confidence</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
              MartPoint is business management software built for Nigerian
              businesses. From your store counter to your boardroom — one
              ecosystem, complete visibility.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="shadow-sm">
                <Link href="/book-demo">
                  Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/request-quote">Request a Quote</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                POS & Sales
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Inventory
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Accounting
              </span>
            </div>
          </div>

          <BusinessVisual />
        </div>
      </div>
    </section>
  )
}
