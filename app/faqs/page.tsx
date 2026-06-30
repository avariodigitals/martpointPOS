export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { FAQPageSchema } from "@/components/structured-data"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const metadata: Metadata = {
  title: "Frequently Asked Questions — MartPoint by Avario Digitals",
  description:
    "Find answers to common questions about MartPoint Retail, MartPoint ERP, PayPlan installment payments, pricing, offline support, and more. Built by Avario Digitals for African businesses.",
  openGraph: {
    title: "Frequently Asked Questions — MartPoint by Avario Digitals",
    description:
      "Find answers to common questions about MartPoint Retail, MartPoint ERP, PayPlan, pricing, offline support, and more.",
  },
}

interface FAQ {
  id: string
  question: string
  answer: string
}

async function readFaqs(): Promise<FAQ[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("faqs")
      .select("id, question, answer")
      .order("sort_order", { ascending: true })

    if (error || !data) return []
    return data.map((row) => ({ id: row.id, question: row.question, answer: row.answer }))
  } catch {
    return []
  }
}

export default async function FAQsPage() {
  const faqs = await readFaqs()

  return (
    <>
      <FAQPageSchema
        faqs={faqs.map((faq) => ({
          question: faq.question,
          answer: faq.answer,
        }))}
      />
      <Header />
      <main>
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Support
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                Frequently Asked Questions
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                Everything you need to know about MartPoint — from pricing and features to PayPlan installment payments and offline support.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={faq.id}
                  className="group rounded-xl border border-border bg-background overflow-hidden open:ring-1 open:ring-retail/20"
                >
                  <summary className="flex items-center justify-between cursor-pointer p-6 text-left select-none list-none">
                    <div className="flex items-start gap-4">
                      <span className="text-sm font-bold text-retail shrink-0 mt-0.5">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-base font-semibold text-foreground leading-snug">
                        {faq.question}
                      </h2>
                    </div>
                    <svg
                      className="w-5 h-5 text-muted-foreground shrink-0 ml-4 transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 pt-0">
                    <div className="pl-8 border-l-2 border-retail-soft">
                      <p className="text-muted-foreground leading-relaxed pl-4">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </details>
              ))}
            </div>

            {faqs.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No FAQs available yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Still have questions */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Still Have Questions?
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed">
                Our team is ready to help. Reach out and we will get back to you as soon as possible.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://wa.me/+2348036028069?text=Hi%2C%20I%20have%20a%20question%20about%20MartPoint.%20Can%20you%20help%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
                >
                  Chat on WhatsApp
                </a>
                <a
                  href="mailto:hello@martpoint.com.ng"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Send an Email
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
