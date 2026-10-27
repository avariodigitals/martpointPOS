import { describe, expect, it } from "vitest"
import { buildCreatorEmailContent } from "@/lib/creator-email"

describe("creator email content", () => {
  it("keeps the message simple and escaped, then appends the configured signature", () => {
    const result = buildCreatorEmailContent("Hello <script>alert(1)</script>\nSecond line", "<p><strong>Creator Team</strong></p>")
    expect(result.html).toContain("Hello &lt;script&gt;alert(1)&lt;/script&gt;")
    expect(result.html).toContain("white-space:pre-wrap")
    expect(result.html).toContain("Second line")
    expect(result.html).toContain("<strong>Creator Team</strong>")
    expect(result.text).toContain("-- \nCreator Team")
    expect(result.html).not.toContain("<script>")
  })

  it("does not append a blank signature block when none is configured", () => {
    const result = buildCreatorEmailContent("Plain message", "")
    expect(result.text).toBe("Plain message")
    expect(result.html).toContain("Plain message")
    expect(result.html).not.toContain("-- </div>")
  })
})
