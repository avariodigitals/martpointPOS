import { readSettings } from "@/lib/settings"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"

export async function OrganizationSchema() {
  const settings = await readSettings()
  const general = settings?.general as Record<string, string> | undefined
  const companyName = general?.companyName || "MartPoint"
  const email = general?.contactEmail || "hello@martpoint.com.ng"
  const whatsapp = general?.whatsappNumber || "+2348036028069"

  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: companyName,
    alternateName: "MartPoint Africa",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.webp`,
    sameAs: [
      "https://www.facebook.com/martpoint.ng",
      "https://www.linkedin.com/company/martpoint",
      "https://www.instagram.com/martpoint.ng",
      "https://twitter.com/martpointng",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: whatsapp,
        contactType: "sales",
        availableLanguage: ["English"],
        areaServed: "NG",
      },
      {
        "@type": "ContactPoint",
        telephone: whatsapp,
        contactType: "customer support",
        availableLanguage: ["English"],
        areaServed: "NG",
      },
    ],
    email,
    description:
      "MartPoint is a African retail and ERP software company providing POS, inventory management, accounting, and business operations tools for supermarkets, pharmacies, restaurants, and fashion stores.",
    foundingDate: "2020",
    address: {
      "@type": "PostalAddress",
      addressCountry: "NG",
      addressLocality: "Lagos",
      addressRegion: "Lagos State",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function WebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MartPoint",
    url: BASE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "MartPoint",
      url: BASE_URL,
      logo: `${BASE_URL}/logo.webp`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SoftwareApplicationSchema({
  name,
  description,
  image,
  url,
  category,
  price,
  operatingSystem = "Windows, macOS, Web Browser",
}: {
  name: string
  description: string
  image: string
  url: string
  category: string
  price?: string
  operatingSystem?: string
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory: category,
    operatingSystem,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: price || "99999",
      availability: "https://schema.org/InStock",
      url,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "127",
      bestRating: "5",
      worstRating: "1",
    },
    image,
    url,
    brand: {
      "@type": "Brand",
      name: "MartPoint",
      logo: `${BASE_URL}/logo.webp`,
    },
    author: {
      "@type": "Organization",
      name: "MartPoint",
      url: BASE_URL,
    },
    provider: {
      "@type": "Organization",
      name: "MartPoint",
      url: BASE_URL,
    },
    featureList: [
      "Point of Sale (POS) System",
      "Inventory Management",
      "Multi-Branch Support",
      "Offline Mode",
      "Sales Analytics & Reporting",
      "Staff Performance Tracking",
      "Receipt Printing",
      "Customer Management",
    ],
    softwareVersion: "2025",
    datePublished: "2020-01-01",
    dateModified: "2025-06-01",
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function ArticleSchema({
  title,
  description,
  image,
  slug,
  publishedAt,
  author,
  keywords,
}: {
  title: string
  description: string
  image: string
  slug: string
  publishedAt: string
  author: string
  keywords?: string
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: image ? `${BASE_URL}${image}` : `${BASE_URL}/og-image.jpg`,
    datePublished: publishedAt,
    dateModified: publishedAt,
    author: {
      "@type": "Organization",
      name: author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "MartPoint",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.webp`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${slug}`,
    },
    keywords: keywords || "POS software, inventory management, retail software Africa",
    articleSection: "Retail Technology",
    inLanguage: "en-NG",
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MartPoint",
    alternateName: "MartPoint Africa",
    url: BASE_URL,
    telephone: "+2348036028069",
    email: "hello@martpoint.ng",
    priceRange: "₦₦",
    areaServed: {
      "@type": "Country",
      name: "Africa",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "MartPoint Software Solutions",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "SoftwareApplication",
            name: "MartPoint Retail",
            description: "POS and inventory management software for supermarkets, pharmacies, restaurants, and fashion stores.",
            applicationCategory: "BusinessApplication",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "SoftwareApplication",
            name: "MartPoint ERP",
            description: "Enterprise resource planning for manufacturing, distribution, and multi-location businesses.",
            applicationCategory: "BusinessApplication",
          },
        },
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "127",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function FAQPageSchema({
  faqs,
}: {
  faqs: Array<{ question: string; answer: string }>
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
