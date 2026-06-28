import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface PlaceholderPageProps {
  title: string
  description: string
  headline?: string
  subtext?: string
}

export function PlaceholderPage({ title, description, headline, subtext }: PlaceholderPageProps) {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <section className="w-full py-24 md:py-32">
          <div className="container-martpoint text-center">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
              {headline || title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              {subtext || description}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild variant="default" className="bg-retail hover:bg-retail/90 text-white">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
