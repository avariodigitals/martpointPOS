/** JSON encoding with recursively sorted object keys, suitable for integrity hashes. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalize(child)])
    return Object.fromEntries(entries)
  }
  return value
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? "null"
}
