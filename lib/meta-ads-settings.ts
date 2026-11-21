import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const DEFAULTS = {
  appId: "1492393586161488",
  loginConfigId: "1411401517644638",
  redirectUri: "https://central.martpoint.com.ng/marketing/ai_ads/broker_callback",
  graphVersion: "v27.0",
}

type MetaAdsSettingsRow = {
  app_id: string
  login_config_id: string
  redirect_uri: string
  graph_version: string
  app_secret_ciphertext: string | null
  token_master_key_ciphertext: string | null
  updated_by: string | null
  updated_at: string
}

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || ""
  if (secret.length < 32) throw new Error("Meta credentials need the existing SESSION_SECRET to encrypt saved credentials.")
  return createHash("sha256").update(`martpoint:meta-ads-platform-settings:v1:${secret}`).digest()
}

export function encryptMetaSetting(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptMetaSetting(value: string): string {
  const [version, ivText, tagText, ciphertextText, ...extra] = value.split(".")
  if (version !== "v1" || !ivText || !tagText || !ciphertextText || extra.length) throw new Error("Saved Meta credential has an unsupported encrypted format.")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8")
}

async function migrateLegacySecret(): Promise<void> {
  if (!isSupabaseConfigured()) return
  const { data: current, error: currentError } = await supabase.from("meta_ads_platform_settings")
    .select("id,app_id,login_config_id,redirect_uri,graph_version,app_secret_ciphertext,token_master_key_ciphertext").eq("id", 1).maybeSingle()
  if (currentError) return // Migration may not be applied yet; the configured fallback remains available.
  if (current?.app_secret_ciphertext) {
    await removeLegacySecret()
    return
  }

  const { data: settingsRow } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
  const settings = (settingsRow?.data || {}) as Record<string, unknown>
  const adLeads = (settings.adLeads || {}) as Record<string, unknown>
  const legacySecret = typeof adLeads.metaAppSecret === "string" ? adLeads.metaAppSecret.trim() : ""
  if (!legacySecret) return

  const row = {
    id: 1,
    app_id: current?.app_id || DEFAULTS.appId,
    login_config_id: current?.login_config_id || DEFAULTS.loginConfigId,
    redirect_uri: current?.redirect_uri || DEFAULTS.redirectUri,
    graph_version: current?.graph_version || DEFAULTS.graphVersion,
    app_secret_ciphertext: encryptMetaSetting(legacySecret),
    token_master_key_ciphertext: current?.token_master_key_ciphertext || null,
    updated_at: new Date().toISOString(),
  }
  const { error: saveError } = await supabase.from("meta_ads_platform_settings").upsert(row, { onConflict: "id" })
  if (saveError) return

  await removeLegacySecret()
}

async function removeLegacySecret(): Promise<void> {
  if (!isSupabaseConfigured()) return
  const { data: settingsRow } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
  const settings = (settingsRow?.data || {}) as Record<string, unknown>
  const adLeads = (settings.adLeads || {}) as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(adLeads, "metaAppSecret")) return
  const cleanSettings = { ...settings, adLeads: { ...adLeads } }
  delete (cleanSettings.adLeads as Record<string, unknown>).metaAppSecret
  await supabase.from("settings").update({ data: cleanSettings, updated_at: new Date().toISOString() }).eq("id", 1)
}

async function readRow(): Promise<MetaAdsSettingsRow | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("meta_ads_platform_settings")
    .select("app_id,login_config_id,redirect_uri,graph_version,app_secret_ciphertext,token_master_key_ciphertext,updated_by,updated_at")
    .eq("id", 1).maybeSingle()
  if (error) return null
  return data as MetaAdsSettingsRow | null
}

async function legacySecret(): Promise<string> {
  if (!isSupabaseConfigured()) return ""
  const { data } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
  const settings = (data?.data || {}) as Record<string, unknown>
  const adLeads = (settings.adLeads || {}) as Record<string, unknown>
  return typeof adLeads.metaAppSecret === "string" ? adLeads.metaAppSecret.trim() : ""
}

export async function getMetaAdsCredentials() {
  await migrateLegacySecret()
  let row = await readRow()
  if (isSupabaseConfigured() && row && !row.token_master_key_ciphertext) {
    const encryptedMasterKey = encryptMetaSetting(randomBytes(32).toString("base64"))
    await supabase.from("meta_ads_platform_settings").update({
      token_master_key_ciphertext: encryptedMasterKey,
      updated_at: new Date().toISOString(),
    }).eq("id", 1).is("token_master_key_ciphertext", null)
    row = await readRow()
  }
  if (isSupabaseConfigured() && !row) {
    const encryptedMasterKey = encryptMetaSetting(randomBytes(32).toString("base64"))
    await supabase.from("meta_ads_platform_settings").insert({
      id: 1, app_id: DEFAULTS.appId, login_config_id: DEFAULTS.loginConfigId,
      redirect_uri: DEFAULTS.redirectUri, graph_version: DEFAULTS.graphVersion,
      token_master_key_ciphertext: encryptedMasterKey, updated_at: new Date().toISOString(),
    })
    row = await readRow()
  }
  let appSecret = ""
  try {
    appSecret = row?.app_secret_ciphertext ? decryptMetaSetting(row.app_secret_ciphertext) : ""
  } catch {
    throw new Error("Saved Meta credentials could not be decrypted. Check the Central SESSION_SECRET before rotating it.")
  }
  if (!appSecret) appSecret = (process.env.MP_META_APP_SECRET || process.env.META_APP_SECRET || await legacySecret()).trim()
  return {
    appId: row?.app_id || process.env.MP_META_APP_ID || DEFAULTS.appId,
    loginConfigId: row?.login_config_id || process.env.MP_META_LOGIN_CONFIG_ID || DEFAULTS.loginConfigId,
    redirectUri: row?.redirect_uri || process.env.MP_META_REDIRECT_URI || DEFAULTS.redirectUri,
    graphVersion: row?.graph_version || process.env.MP_META_GRAPH_VERSION || DEFAULTS.graphVersion,
    appSecret,
    tokenMasterKey: row?.token_master_key_ciphertext ? decryptMetaSetting(row.token_master_key_ciphertext) : "",
    updatedAt: row?.updated_at || null,
    source: row?.app_secret_ciphertext ? "admin" as const : appSecret ? "environment" as const : "missing" as const,
  }
}

export async function getMetaAdsSettingsSummary() {
  const settings = await getMetaAdsCredentials()
  return {
    appId: settings.appId,
    loginConfigId: settings.loginConfigId,
    redirectUri: settings.redirectUri,
    graphVersion: settings.graphVersion,
    appSecretConfigured: Boolean(settings.appSecret),
    appSecretSource: settings.source,
    appSecretHint: settings.appSecret ? `••••${settings.appSecret.slice(-4)}` : "",
    updatedAt: settings.updatedAt,
  }
}

export async function saveMetaAdsSettings(input: {
  appId: string
  loginConfigId: string
  redirectUri: string
  graphVersion: string
  appSecret?: string
  clearAppSecret?: boolean
  updatedBy: string
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.")
  await getMetaAdsCredentials() // Provision the stable master key once before credential updates.
  const existing = await readRow()
  const currentSecret = existing?.app_secret_ciphertext ? decryptMetaSetting(existing.app_secret_ciphertext) : ""
  const envSecret = process.env.MP_META_APP_SECRET || process.env.META_APP_SECRET || ""
  const appSecret = input.clearAppSecret ? "" : input.appSecret?.trim() || currentSecret || envSecret
  if (!input.clearAppSecret && !appSecret) throw new Error("Enter the Meta App Secret before saving.")
  const { error } = await supabase.from("meta_ads_platform_settings").upsert({
    id: 1,
    app_id: input.appId,
    login_config_id: input.loginConfigId,
    redirect_uri: input.redirectUri,
    graph_version: input.graphVersion,
    app_secret_ciphertext: appSecret ? encryptMetaSetting(appSecret) : null,
    token_master_key_ciphertext: existing?.token_master_key_ciphertext || encryptMetaSetting(randomBytes(32).toString("base64")),
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" })
  if (error) throw new Error("Could not save Meta Ads settings.")
  await migrateLegacySecret() // Also removes any pre-existing plaintext copy.
}
