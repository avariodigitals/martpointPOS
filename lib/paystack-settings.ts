import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type PaystackMode = "test" | "live"
type StoredSettings = { id: number; active_mode: PaystackMode; live_secret_encrypted: string | null; test_secret_encrypted: string | null; updated_by: string | null; updated_at: string }

export type PaystackConfiguration = {
  activeMode: PaystackMode
  liveSecret: string
  testSecret: string
  liveSource: "admin" | "environment" | "missing"
  testSource: "admin" | "environment" | "missing"
  updatedAt: string | null
}

function encryptionKey(): Buffer {
  const sessionSecret = process.env.SESSION_SECRET || ""
  if (sessionSecret.length < 32) throw new Error("Paystack settings need the existing SESSION_SECRET to encrypt saved credentials.")
  return createHash("sha256").update(`martpoint:paystack-settings:v1:${sessionSecret}`).digest()
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

function decryptSecret(value: string): string {
  const [version, ivText, tagText, cipherText, ...extra] = value.split(".")
  if (version !== "v1" || !ivText || !tagText || !cipherText || extra.length) throw new Error("Saved Paystack key has an unsupported encrypted format.")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(cipherText, "base64url")), decipher.final()]).toString("utf8")
}

async function readStoredSettings(): Promise<{ row: StoredSettings | null; readError: string | null }> {
  if (!isSupabaseConfigured()) return { row: null, readError: "Supabase is not configured." }
  const { data, error } = await supabase.from("paystack_gateway_settings").select("*").eq("id", 1).maybeSingle()
  return { row: data as StoredSettings | null, readError: error?.message || null }
}

export async function loadPaystackConfiguration(): Promise<PaystackConfiguration> {
  const { row, readError } = await readStoredSettings()
  const environmentLive = process.env.PAYSTACK_SECRET_KEY || ""
  const environmentTest = process.env.PAYSTACK_TEST_SECRET_KEY || ""
  if (readError && !environmentLive && !environmentTest) throw new Error("Paystack settings are unavailable. Apply migration 187 and check the database connection.")

  const adminLive = row?.live_secret_encrypted ? decryptSecret(row.live_secret_encrypted) : ""
  const adminTest = row?.test_secret_encrypted ? decryptSecret(row.test_secret_encrypted) : ""
  const liveSecret = adminLive || environmentLive
  const testSecret = adminTest || environmentTest
  const activeMode = row?.active_mode || (process.env.CENTRAL_BILLING_TEST_MODE === "true" || (!environmentLive && Boolean(environmentTest)) ? "test" : "live")
  return {
    activeMode,
    liveSecret,
    testSecret,
    liveSource: adminLive ? "admin" : environmentLive ? "environment" : "missing",
    testSource: adminTest ? "admin" : environmentTest ? "environment" : "missing",
    updatedAt: row?.updated_at || null,
  }
}

export async function getPaystackSecret(mode?: PaystackMode): Promise<string> {
  const settings = await loadPaystackConfiguration()
  const secret = mode === "test" ? settings.testSecret : mode === "live" ? settings.liveSecret : settings.activeMode === "test" ? settings.testSecret : settings.liveSecret
  if (!secret) throw new Error(`Paystack ${mode || settings.activeMode} mode is not configured.`)
  return secret
}

export async function getPaystackWebhookSecrets(): Promise<string[]> {
  const settings = await loadPaystackConfiguration()
  return [...new Set([settings.liveSecret, settings.testSecret].filter(Boolean))]
}

export async function getPaystackSettingsSummary() {
  const settings = await loadPaystackConfiguration()
  const masked = (secret: string) => secret ? `••••${secret.slice(-4)}` : ""
  return {
    activeMode: settings.activeMode,
    liveConfigured: Boolean(settings.liveSecret),
    testConfigured: Boolean(settings.testSecret),
    liveSource: settings.liveSource,
    testSource: settings.testSource,
    liveHint: masked(settings.liveSecret),
    testHint: masked(settings.testSecret),
    updatedAt: settings.updatedAt,
  }
}

export function encryptPaystackSecret(secret: string): string { return encryptSecret(secret) }
