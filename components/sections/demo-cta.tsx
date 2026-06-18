import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Phone } from "lucide-react"

export function DemoCTA() {
  return (
    <section className="w-full bg-accent/10 border-y border-accent/20 py-16 md:py-24">
      <div className="container-martpoint">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            See how MartPoint works for your business
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Book a 20-minute demo with our team. We&apos;ll show you the features
            that matter for your specific industry and answer every question.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="shadow-sm">
              <Link href="/book-demo">
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">
                <Phone className="mr-2 h-4 w-4" />
                Talk to Sales
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No commitment required. Demo is free and tailored to your business
            type.
          </p>
        </div>
      </div>
    </section>
  )
}
