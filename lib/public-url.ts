const DEFAULT_PUBLIC_ORIGIN = "https://martpoint.com.ng"

/** Build a valid absolute URL for links sent in email, even when deployment
 * configuration contains only a path or a malformed value such as `http://`. */
export function publicUrl(pathOrUrl: string | null | undefined, fallbackPath = "/"): string {
  const value = pathOrUrl?.trim() || fallbackPath
  try {
    const absolute = new URL(value)
    if (["http:", "https:"].includes(absolute.protocol) && absolute.hostname) return absolute.toString()
  } catch {
    // Treat non-absolute values as paths below.
  }

  let origin = DEFAULT_PUBLIC_ORIGIN
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_PUBLIC_ORIGIN)
    if (["http:", "https:"].includes(configured.protocol) && configured.hostname) origin = configured.origin
  } catch {
    // Keep the canonical production origin if the environment value is invalid.
  }

  const path = value.startsWith("/") ? value : fallbackPath
  return new URL(path, `${origin}/`).toString()
}
