import Link from "next/link"
import Image from "next/image"

const productLinks = [
  { label: "MartPoint Retail", href: "/martpoint-retail" },
  { label: "MartPoint ERP", href: "/martpoint-erp" },
  { label: "Pricing", href: "/pricing" },
  { label: "Industries", href: "/industries" },
]

const companyLinks = [
  { label: "Book a Demo", href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" },
  { label: "Request a Quote", href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" },
  { label: "Contact Sales", href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" },
]

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
]

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-muted">
      <div className="container-martpoint py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          <div className="md:col-span-1">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="MartPoint"
                width={280}
                height={72}
                className="h-20 w-auto"
              />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Business management software built for Nigerian retail stores and enterprises.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Products
            </h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Get Started
            </h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MartPoint. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built for Nigerian businesses.
          </p>
        </div>
      </div>
    </footer>
  )
}
