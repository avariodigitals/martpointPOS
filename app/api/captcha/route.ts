import { NextResponse } from "next/server"
import { getCaptchaConfig } from "@/lib/captcha"

// Returns the active captcha provider + public site key so client forms can
// render the right widget. The secret key never leaves the server.
export async function GET() {
  const config = await getCaptchaConfig()
  return NextResponse.json(
    config
      ? { provider: config.provider, siteKey: config.siteKey }
      : { provider: null, siteKey: null }
  )
}
