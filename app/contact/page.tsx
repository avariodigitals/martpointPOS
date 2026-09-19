export const revalidate = 86400
import type { Metadata } from "next"
import { Mail, Phone, MessageCircle } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"
import { getPublicSiteSettings } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Contact Sales — Talk to MartPoint Team",
  description: "Talk to our sales team about MartPoint POS and ERP software for your business in Nigeria and Africa.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Sales — Talk to MartPoint Team",
    description: "Talk to our sales team about MartPoint POS and ERP for your business.",
    url: "https://martpoint.com.ng/contact",
  },
}

export default async function ContactPage() {
  const site = await getPublicSiteSettings()
  const whatsapp = site.whatsappNumber?.trim()
  const phone = site.phone?.trim()

  const cards = [
    site.contactEmail && {
      href: `mailto:${site.contactEmail}`,
      icon: Mail,
      label: "Email us",
      value: site.contactEmail,
    },
    whatsapp && {
      href: `https://wa.me/${whatsapp.replace(/\D/g, "")}`,
      icon: MessageCircle,
      label: "Call / WhatsApp",
      value: whatsapp,
    },
    phone && {
      href: `tel:${phone.replace(/\s+/g, "")}`,
      icon: Phone,
      label: "Call us",
      value: phone,
    },
  ].filter((c): c is { href: string; icon: typeof Mail; label: string; value: string } => Boolean(c))

  const colsClass =
    ({ 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const)[
      Math.min(cards.length, 3) as 1 | 2 | 3
    ] || ""

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              <LeadForm pageType="contact" />

              {cards.length > 0 && (
                <div className="mt-16 border-t border-border pt-10">
                  <h2 className="text-center text-xl font-semibold text-foreground">
                    Prefer to reach us directly?
                  </h2>
                  <div className={`mt-6 grid gap-4 ${colsClass}`}>
                    {cards.map((card) => (
                      <a
                        key={card.href}
                        href={card.href}
                        target={card.href.startsWith("https://wa.me") ? "_blank" : undefined}
                        rel={card.href.startsWith("https://wa.me") ? "noopener noreferrer" : undefined}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-5 text-center transition-colors hover:border-retail/40 hover:bg-retail-soft/40"
                      >
                        <card.icon className="h-5 w-5 text-retail" />
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
                        <span className="text-sm font-medium text-foreground">{card.value}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
