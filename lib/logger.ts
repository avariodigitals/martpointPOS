type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  module: string
  operation: string
  entityId?: string
  requestId?: string
  [key: string]: unknown
}

const REDACTED_KEYS = ["password", "token", "secret", "cookie", "session", "api_key", "apikey", "card", "cvv", "authorization"]

function sanitise(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!payload) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (REDACTED_KEYS.some((k) => key.toLowerCase().includes(k))) {
      out[key] = "[REDACTED]"
    } else {
      out[key] = value
    }
  }
  return out
}

export function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
  const entry = {
    timestamp: new Date().toISOString(),
    severity: level,
    message,
    ...sanitise(context as any),
    error: error ? { name: error.name, message: error.message } : undefined,
  }

  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}
