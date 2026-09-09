import { readSettings } from "./settings"

export type CaptchaProvider = "turnstile" | "recaptcha"

const VERIFY_URLS: Record<CaptchaProvider, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
}

export interface CaptchaConfig {
  provider: CaptchaProvider
  siteKey: string
  secretKey: string
}

interface SecuritySettings {
  captchaProvider?: string
  turnstileSiteKey?: string
  turnstileSecretKey?: string
  recaptchaSiteKey?: string
  recaptchaSecretKey?: string
}

function envConfig(): CaptchaConfig | null {
  const recaptchaSite = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY
  if (recaptchaSite && recaptchaSecret) {
    return { provider: "recaptcha", siteKey: recaptchaSite, secretKey: recaptchaSecret }
  }
  const turnstileSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  if (turnstileSite && turnstileSecret) {
    return { provider: "turnstile", siteKey: turnstileSite, secretKey: turnstileSecret }
  }
  return null
}

function settingsConfig(security: SecuritySettings): CaptchaConfig | null {
  const provider: CaptchaProvider =
    security.captchaProvider === "recaptcha" ? "recaptcha" : "turnstile"

  const siteKey =
    provider === "recaptcha"
      ? security.recaptchaSiteKey
      : security.turnstileSiteKey
  const secretKey =
    provider === "recaptcha"
      ? security.recaptchaSecretKey
      : security.turnstileSecretKey

  if (siteKey && secretKey) {
    return { provider, siteKey: String(siteKey), secretKey: String(secretKey) }
  }

  // Auto-detect: fall back to whichever provider has a complete key pair.
  if (security.recaptchaSiteKey && security.recaptchaSecretKey) {
    return {
      provider: "recaptcha",
      siteKey: String(security.recaptchaSiteKey),
      secretKey: String(security.recaptchaSecretKey),
    }
  }
  if (security.turnstileSiteKey && security.turnstileSecretKey) {
    return {
      provider: "turnstile",
      siteKey: String(security.turnstileSiteKey),
      secretKey: String(security.turnstileSecretKey),
    }
  }
  return null
}

/**
 * Resolve the active captcha configuration. Environment variables take
 * precedence; otherwise fall back to Admin Settings → Security.
 * Returns null when captcha is not configured.
 */
export async function getCaptchaConfig(): Promise<CaptchaConfig | null> {
  const fromEnv = envConfig()
  if (fromEnv) return fromEnv

  try {
    const settings = await readSettings()
    const security =
      (settings?.security as SecuritySettings | undefined) || {}
    return settingsConfig(security)
  } catch {
    return null
  }
}

export async function isCaptchaEnabled(): Promise<boolean> {
  return (await getCaptchaConfig()) !== null
}

function clientIp(request: Request): string | undefined {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]?.trim()
  return request.headers.get("cf-connecting-ip") || undefined
}

export interface CaptchaVerifyResult {
  success: boolean
  skipped?: boolean
  error?: string
}

/**
 * Verify a captcha response token against the configured provider's
 * siteverify endpoint. When captcha is not configured, verification is
 * skipped so forms keep working before keys are set up.
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  request: Request
): Promise<CaptchaVerifyResult> {
  const config = await getCaptchaConfig()
  if (!config) return { success: true, skipped: true }

  if (!token) {
    return {
      success: false,
      error: "Security verification failed. Please refresh the page and try again.",
    }
  }

  try {
    const body = new URLSearchParams()
    body.set("secret", config.secretKey)
    body.set("response", token)
    const ip = clientIp(request)
    if (ip) body.set("remoteip", ip)

    const res = await fetch(VERIFY_URLS[config.provider], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const data = (await res.json()) as {
      success?: boolean
      "error-codes"?: string[]
    }

    if (data.success) return { success: true }
    return {
      success: false,
      error: "Security verification failed. Please try again.",
    }
  } catch {
    // Verification service unreachable — fail closed to stay protected.
    return {
      success: false,
      error: "Security verification is temporarily unavailable. Please try again later.",
    }
  }
}
