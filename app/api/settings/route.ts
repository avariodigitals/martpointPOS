import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const settingsPath = path.join(process.cwd(), "data", "settings.json")

function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      return {}
    }
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export async function GET() {
  const settings = readSettings()
  // Only expose public-safe settings
  return NextResponse.json({
    popup: settings.popup || null,
    general: {
      companyName: settings.general?.companyName || "MartPoint",
      whatsappNumber: settings.general?.whatsappNumber || "",
      contactEmail: settings.general?.contactEmail || "",
    },
  })
}
