import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import fs from "fs"
import path from "path"

const settingsPath = path.join(process.cwd(), "data", "settings.json")

function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      return getDefaultSettings()
    }
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return getDefaultSettings()
  }
}

function getDefaultSettings() {
  return {
    seo: {
      title: "MartPoint — Retail & ERP Software for African Businesses",
      description:
        "Business management software built for African retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem.",
      keywords: "pos software nigeria, retail software, inventory management, erp nigeria, supermarket pos",
      ogImage: "/og-image.jpg",
    },
    analytics: {
      ga4MeasurementId: "",
      gtmId: "",
      fbPixelId: "",
      clarityId: "",
      hotjarId: "",
    },
    general: {
      contactEmail: "hello@martpoint.com.ng",
      whatsappNumber: "+2348036028069",
      companyName: "MartPoint",
    },
    social: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    searchConsole: {
      verificationCode: "",
    },
    openai: {
      apiKey: "",
    },
    popup: {
      enabled: true,
      trigger: "mouseleave",
      delaySeconds: 0,
      maxShowsPerSession: 1,
      title: "Start With MartPoint Retail Cloud",
      priceText: "₦99,999 / Year",
      priceSubtext: "Everything you need to run a modern retail business.",
      ctaText: "Get Started on WhatsApp",
      ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F",
    },
    header: {
      logo: "/logo.webp",
      favicon: "/icon.webp",
      ctaText: "Book a Call",
      ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F",
      secondaryCtaText: "See Plans",
      secondaryCtaLink: "/pricing",
    },
    footer: {
      logo: "/logo.webp",
      description: "MartPoint helps businesses track sales, manage inventory, monitor staff and make better decisions with real-time insights.",
      copyrightText: "MartPoint. All rights reserved.",
      tagline: "Built for African businesses.",
    },
    pricing: {
      cloud: {
        name: "MartPoint Retail Cloud",
        price: "₦99,999",
        period: "/ Year",
        badge: "Most Popular",
        description: "Everything you need to run a modern retail business.",
        features: [
          "POS Sales & Checkout",
          "Inventory & Stock Control",
          "Online Store",
          "WhatsApp Ordering & Invoice",
          "QR Menu Ordering",
          "Payment Links",
          "PayPlan™ Installment Plans",
          "Loyalty & Rewards",
          "Customer Verification",
          "Collections Tracking",
          "Attendance (Face Capture)",
          "Daily Report",
          "AI Chatbot",
          "Training & Onboarding",
          "Mobile & Desktop Access",
        ],
        branchesIncluded: 1,
        usersIncluded: 5,
        branchAddonPrice: "₦49,999 / Year",
        ctaText: "Get Started",
        ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F",
      },
      offline: {
        name: "MartPoint Retail Offline",
        price: "₦250,000",
        period: "One-Time Payment",
        badge: "One-Time",
        description: "Full software installed locally. No recurring subscription. Works without internet.",
        features: [
          "POS Sales & Checkout",
          "Inventory & Stock Control",
          "Receipt Printing",
          "Barcode & SKU Management",
          "Customer & Supplier Records",
          "Staff Attendance (Face Capture)",
          "Daily Sales Report",
          "Multi-Branch (LAN Connected)",
          "Offline-First Sync",
          "Local Installation",
          "Staff Setup & Training",
          "No Recurring Fees",
        ],
        branchAddonPrice: "₦100,000 One-Time",
        supportRenewal: "₦50,000 / Year",
        ctaText: "Request Offline Setup",
        ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Offline%20setup.%20Can%20we%20talk%3F",
      },
      erp: [
        {
          name: "Growth",
          price: "₦85,000",
          period: "/ month",
          badge: "",
          description: "For SMEs ready to systematize operations",
          features: [
            "Up to 20 employees",
            "Accounting module",
            "Procurement module",
            "Basic HR & CRM",
            "Standard reports",
            "Email support",
          ],
          branchesIncluded: 1,
          usersIncluded: 5,
          ctaText: "Get Started",
          ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%27m%20interested%20in%20the%20MartPoint%20ERP%20Growth%20plan.%20Can%20we%20talk%3F",
        },
        {
          name: "Scale",
          price: "₦180,000",
          period: "/ month",
          badge: "Most Popular",
          description: "For multi-department businesses",
          features: [
            "Up to 100 employees",
            "Full accounting suite",
            "Advanced procurement",
            "Manufacturing module",
            "HR, CRM & approvals",
            "Custom reports",
            "Priority support",
          ],
          branchesIncluded: 1,
          usersIncluded: 10,
          ctaText: "Get Started",
          ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%27m%20interested%20in%20the%20MartPoint%20ERP%20Scale%20plan.%20Can%20we%20talk%3F",
        },
        {
          name: "Corporate",
          price: "Custom",
          period: "",
          badge: "Enterprise",
          description: "For enterprises with complex needs",
          features: [
            "Unlimited employees",
            "All modules included",
            "Custom workflows",
            "API access",
            "White-label options",
            "Dedicated support team",
          ],
          branchesIncluded: 0,
          usersIncluded: 0,
          ctaText: "Request Quote",
          ctaLink: "/request-quote",
        },
      ],
    },
  }
}

function writeSettings(settings: unknown) {
  try {
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8")
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = readSettings()
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const current = readSettings()
    const updated = { ...current, ...body }

    const success = writeSettings(updated)
    if (!success) {
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, settings: updated })
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
