export function contactCentreUrl(path: string) {
  let origin = "https://martpoint.com.ng"
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_BASE_URL || origin)
    if (
      ["https:", "http:"].includes(configured.protocol) &&
      configured.hostname
    )
      origin = configured.origin
  } catch {
    /* Keep a real public origin if a deployment variable is malformed. */
  }
  return new URL(
    path.startsWith("/admin/azera") ? path : "/admin/azera",
    origin
  ).toString()
}
