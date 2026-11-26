/* ────────────────────────  Shared AI chat with configurable providers  ────────────────────────
 * All LLM calls use the provider selected in Admin Settings. Optional
 * OpenAI-compatible fallbacks can be enabled and ordered after the active
 * provider. Provider keys, endpoints and model IDs are configured per provider.
 */

import { readSettings } from "./settings"

export interface AiChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AiChatOptions {
  model?: string
  messages: AiChatMessage[]
  temperature?: number
  maxTokens?: number
  json?: boolean
  /** Maximum total time allowed for provider attempts, in milliseconds. */
  timeoutMs?: number
}

export interface AiChatResult {
  content: string
  model: string
  provider: string
}

export type AiChatDeltaHandler = (delta: string) => void | Promise<void>

interface ProviderConfig {
  id: AiProviderId
  name: string
  apiKey?: string
  baseUrl?: string
  model: string
}

export type AiProviderId = "openai" | "xiaomi" | "xai" | "groq" | "openrouter" | "mistral" | "gemini" | "custom"

interface AiProviderSetting {
  apiKey?: string
  baseUrl?: string
  model?: string
  enabled?: boolean
}

interface AiSettings {
  activeProvider?: AiProviderId
  fallbackEnabled?: boolean
  providers?: Partial<Record<AiProviderId, AiProviderSetting>>
}

const PROVIDER_DEFAULTS: Record<AiProviderId, { name: string; baseUrl?: string; model: string; envKey?: string; envBase?: string; envModel?: string }> = {
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", envKey: "OPENAI_API_KEY", envBase: "OPENAI_BASE_URL", envModel: "OPENAI_MODEL" },
  xiaomi: { name: "Xiaomi MiMo", baseUrl: "https://api.xiaomimimo.com/v1", model: "mimo-v2.6-pro" },
  xai: { name: "xAI / Grok", baseUrl: "https://api.x.ai/v1", model: "grok-4-fast-latest", envKey: "XAI_API_KEY", envBase: "XAI_BASE_URL", envModel: "XAI_MODEL" },
  groq: { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", envKey: "GROQ_API_KEY", envBase: "GROQ_BASE_URL", envModel: "GROQ_MODEL" },
  openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", envKey: "OPENROUTER_API_KEY", envBase: "OPENROUTER_BASE_URL", envModel: "OPENROUTER_MODEL" },
  mistral: { name: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", envKey: "MISTRAL_API_KEY", envBase: "MISTRAL_BASE_URL", envModel: "MISTRAL_MODEL" },
  gemini: { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash", envKey: "GEMINI_API_KEY", envBase: "GEMINI_BASE_URL", envModel: "GEMINI_MODEL" },
  custom: { name: "Custom OpenAI-compatible", model: "gpt-4o-mini", envKey: "AI_API_KEY", envBase: "AI_BASE_URL", envModel: "AI_MODEL" },
}

function usableApiKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const key = value.trim()
  if (!key || /your[-_ ]|example|placeholder|replace[-_ ]?me/i.test(key)) return undefined
  return key
}

function currentModel(id: AiProviderId, value: string | undefined, fallback: string): string {
  const model = (value || fallback).trim()
  // Gemini 2.0 Flash was shut down; stored settings from before the upgrade
  // should move to Google's current stable Flash model automatically.
  if (id === "gemini" && model === "gemini-2.0-flash") return "gemini-3.8-flash"
  return model
}

async function getStoredAiSettings(): Promise<{ ai?: AiSettings; openai?: Record<string, string>; xai?: Record<string, string> }> {
  try {
    const settings = await readSettings()
    return {
      ai: settings?.ai as AiSettings | undefined,
      openai: settings?.openai as Record<string, string> | undefined,
      xai: settings?.xai as Record<string, string> | undefined,
    }
  } catch {
    // ignore
  }
  return {}
}

export function hasAnyAiKey(): boolean {
  return Boolean(
    usableApiKey(process.env.OPENAI_API_KEY) ||
    usableApiKey(process.env.XAI_API_KEY) ||
    usableApiKey(process.env.GROQ_API_KEY) ||
    usableApiKey(process.env.OPENROUTER_API_KEY) ||
    usableApiKey(process.env.MISTRAL_API_KEY) ||
    usableApiKey(process.env.GEMINI_API_KEY) ||
    usableApiKey(process.env.AI_API_KEY),
  )
}

async function getProviderCandidates(): Promise<ProviderConfig[]> {
  const stored = await getStoredAiSettings()
  const ai = stored.ai || {}
  const configured = {} as Record<AiProviderId, ProviderConfig | null>
  for (const id of Object.keys(PROVIDER_DEFAULTS) as AiProviderId[]) {
    const defaults = PROVIDER_DEFAULTS[id]
    const saved = ai.providers?.[id] || {}
    const legacy = !stored.ai?.providers ? (id === "openai" ? stored.openai : id === "xai" ? stored.xai : undefined) : undefined
    const apiKey = usableApiKey(saved.apiKey) || usableApiKey(legacy?.apiKey) || (defaults.envKey ? usableApiKey(process.env[defaults.envKey]) : undefined)
    const envBase = defaults.envBase ? process.env[defaults.envBase]?.trim() : ""
    const baseUrl = (saved.baseUrl || (id === "xai" ? legacy?.baseUrl : "") || envBase || defaults.baseUrl || "").trim() || undefined
    const envModel = defaults.envModel ? process.env[defaults.envModel]?.trim() : ""
    const model = currentModel(id, saved.model || (id === "xai" ? legacy?.model : "") || envModel, defaults.model)
    configured[id] = apiKey ? { id, name: defaults.name, apiKey, baseUrl, model } : null
  }

  const customEnvKey = usableApiKey(process.env.AI_API_KEY)
  if (customEnvKey && !configured.custom) {
    configured.custom = {
      id: "custom",
      name: PROVIDER_DEFAULTS.custom.name,
      apiKey: customEnvKey,
      baseUrl: process.env.AI_BASE_URL?.trim() || undefined,
      model: process.env.AI_MODEL?.trim() || PROVIDER_DEFAULTS.custom.model,
    }
  }

  const activeId = ai.activeProvider && PROVIDER_DEFAULTS[ai.activeProvider] ? ai.activeProvider : "openai"
  const activeProvider = configured[activeId]
  const fallbackEnabled = ai.fallbackEnabled !== false
  const fallbackIds = (Object.keys(PROVIDER_DEFAULTS) as AiProviderId[]).filter((id) =>
    id !== activeId && ai.providers?.[id]?.enabled !== false && Boolean(configured[id]),
  )
  return [
    ...(activeProvider ? [activeProvider] : []),
    ...(fallbackEnabled ? fallbackIds.map((id) => configured[id]!).filter(Boolean) : []),
  ]
}

/** Server-only provider credentials for non-chat APIs such as image generation.
 * Never call this from a client component or return its result in an API response.
 */
export async function getAiProviderCredentials(id: AiProviderId): Promise<ProviderConfig | null> {
  const stored = await getStoredAiSettings()
  const defaults = PROVIDER_DEFAULTS[id]
  const saved = stored.ai?.providers?.[id] || {}
  // An explicitly disabled provider must not be used for creative generation,
  // even if a previous key remains stored.
  if (saved.enabled === false && usableApiKey(saved.apiKey)) return null
  const legacy = !stored.ai?.providers ? (id === "openai" ? stored.openai : id === "xai" ? stored.xai : undefined) : undefined
  const apiKey = usableApiKey(saved.apiKey) || usableApiKey(legacy?.apiKey) || (defaults.envKey ? usableApiKey(process.env[defaults.envKey]) : undefined)
  if (!apiKey) return null
  const envBase = defaults.envBase ? process.env[defaults.envBase]?.trim() : ""
  const baseUrl = (saved.baseUrl || (id === "xai" ? legacy?.baseUrl : "") || envBase || defaults.baseUrl || "").trim() || undefined
  const envModel = defaults.envModel ? process.env[defaults.envModel]?.trim() : ""
  const model = currentModel(id, saved.model || (id === "xai" ? legacy?.model : "") || envModel, defaults.model)
  return { id, name: defaults.name, apiKey, baseUrl, model }
}

/** Safe, non-secret provider status for admin diagnostics. */
export async function getAiProviderStatus(): Promise<{
  openaiConfigured: boolean
  fallbackConfigured: boolean
  configured: boolean
  activeProvider: AiProviderId
  fallbackEnabled: boolean
}> {
  const stored = await getStoredAiSettings()
  const providers = await getProviderCandidates()
  return {
    openaiConfigured: providers.some((provider) => provider.id === "openai"),
    fallbackConfigured: providers.some((provider) => provider.id !== "openai"),
    configured: providers.length > 0,
    activeProvider: stored.ai?.activeProvider || "openai",
    fallbackEnabled: stored.ai?.fallbackEnabled !== false,
  }
}

async function complete(
  provider: ProviderConfig,
  opts: AiChatOptions
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  if (!provider.apiKey) throw new Error(`${provider.name} API key not configured`)

  const client = new OpenAI({
    apiKey: provider.apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    timeout: Math.max(1000, opts.timeoutMs ?? 12000),
  })
  const model = provider.model || opts.model || PROVIDER_DEFAULTS.openai.model
  const completion = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1600,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  })
  return {
    content: completion.choices[0]?.message?.content?.trim() || "",
    model: completion.model || model,
    provider: provider.name,
  }
}

async function streamComplete(
  provider: ProviderConfig,
  opts: AiChatOptions,
  onDelta: AiChatDeltaHandler,
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  if (!provider.apiKey) throw new Error(`${provider.name} API key not configured`)

  const client = new OpenAI({
    apiKey: provider.apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    timeout: Math.max(1000, opts.timeoutMs ?? 12000),
  })
  const model = provider.model || opts.model || PROVIDER_DEFAULTS.openai.model
  const completion = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1600,
    stream: true,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  })

  let content = ""
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || ""
    if (!delta) continue
    content += delta
    await onDelta(delta)
  }

  return {
    content: content.trim(),
    model,
    provider: provider.name,
  }
}

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  const providers = await getProviderCandidates()
  if (!providers.length) throw new Error("No AI provider key configured")

  const totalTimeoutMs = Math.max(1000, opts.timeoutMs ?? 15000)
  const deadline = Date.now() + totalTimeoutMs
  const failures: string[] = []
  for (const provider of providers) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    try {
      return await complete(provider, { ...opts, timeoutMs: remainingMs })
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : "request failed"}`)
    }
  }

  throw new Error(failures.join("; ") || "AI response timed out")
}

/**
 * Stream the first configured provider that can answer. A provider is only
 * retried when it fails before emitting any content; once content is visible
 * to a visitor, switching providers could duplicate part of the answer.
 */
export async function aiChatStream(
  opts: AiChatOptions,
  onDelta: AiChatDeltaHandler,
): Promise<AiChatResult> {
  const providers = await getProviderCandidates()
  if (!providers.length) throw new Error("No AI provider key configured")

  const totalTimeoutMs = Math.max(1000, opts.timeoutMs ?? 15000)
  const deadline = Date.now() + totalTimeoutMs
  const failures: string[] = []
  let emittedContent = false

  for (const provider of providers) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    try {
      return await streamComplete(
        provider,
        { ...opts, timeoutMs: remainingMs },
        async (delta) => {
          emittedContent = true
          await onDelta(delta)
        },
      )
    } catch (error) {
      if (emittedContent) throw error
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : "request failed"}`)
    }
  }

  throw new Error(failures.join("; ") || "AI response timed out")
}
