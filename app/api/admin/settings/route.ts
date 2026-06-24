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
      title: "MartPoint — Retail & ERP Software for Nigerian Businesses",
      description:
        "Business management software built for Nigerian retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem.",
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
    openai: {
      apiKey: "",
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
