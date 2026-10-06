import { describe, expect, it } from "vitest"
import { brandedEmailHtml, ensureBrandedHtml } from "../lib/email-templates"

describe("brandedEmailHtml", () => {
  it("wraps a body fragment in the MartPoint shell", () => {
    const html = brandedEmailHtml("<p>Hello world</p>", { title: "Test" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("linear-gradient(135deg, #0057FF")
    // Header must never render the coloured logo on the dark gradient.
    expect(html).not.toContain("/logo.webp")
    expect(html).toContain("<p>Hello world</p>")
  })

  it("renders a rich footer: social chips, contact, copyright and banner", () => {
    const html = brandedEmailHtml("<p>x</p>", { signoff: "MartPoint Billing" })
    // Social chips for every configured network.
    for (const label of ["Facebook", "Instagram", "LinkedIn", "YouTube", "TikTok"]) {
      expect(html).toContain(`title="${label}"`)
    }
    // Contact + copyright + banner image.
    expect(html).toContain("mailto:sales@martpoint.com.ng")
    expect(html).toContain(`&copy; ${new Date().getFullYear()} MartPoint Solutions. All rights reserved.`)
    expect(html).toContain("/footerbanner.png")
    expect(html).toContain("Best regards,<br/>")
  })

  it("falls back to a styled banner bar when no banner image is configured", () => {
    const html = brandedEmailHtml("<p>x</p>", { footer: { bannerImageUrl: "" } })
    expect(html).not.toContain("/footerbanner.png")
    expect(html).toContain("The operating system for African retail")
  })

  it("omits social chips when none are configured", () => {
    const html = brandedEmailHtml("<p>x</p>", { footer: { social: {}, contactEmail: "", phone: "" } })
    expect(html).not.toContain('title="Facebook"')
    expect(html).toContain("All rights reserved.")
  })

  it("uses the white logo in the header by default", () => {
    const html = brandedEmailHtml("<p>x</p>")
    expect(html).toContain("/logo-white.png")
    expect(html).toContain('alt="MartPoint"')
    // Never the coloured logo on the dark gradient.
    expect(html).not.toContain("/logo.webp")
  })

  it("renders a custom white logo URL when provided", () => {
    const html = brandedEmailHtml("<p>x</p>", { logoWhiteUrl: "https://cdn.test/logo-white.png" })
    expect(html).toContain('src="https://cdn.test/logo-white.png"')
    expect(html).toContain('alt="MartPoint"')
  })

  it("falls back to a white wordmark when the white logo is disabled", () => {
    const html = brandedEmailHtml("<p>x</p>", { logoWhiteUrl: null })
    expect(html).toContain("color:#ffffff; font-size:26px; font-weight:700")
    expect(html).not.toContain("/logo-white.png")
    expect(html).not.toContain("/logo.webp")
  })

  it("escapes the title and eyebrow", () => {
    const html = brandedEmailHtml("<p>x</p>", { title: "<script>", eyebrow: "A & B" })
    expect(html).not.toContain("<title><script></title>")
    expect(html).toContain("A &amp; B")
  })
})

describe("ensureBrandedHtml", () => {
  it("returns an already-branded full document untouched", () => {
    const branded = brandedEmailHtml("<p>Keep me</p>")
    expect(ensureBrandedHtml(branded)).toBe(branded)
  })

  it("wraps a bare HTML fragment in the branded shell", () => {
    const out = ensureBrandedHtml("<div><h2>Welcome</h2></div>")
    expect(out).toContain("linear-gradient(135deg, #0057FF")
    expect(out).toContain("<h2>Welcome</h2>")
  })

  it("brands a legacy unbranded full document", () => {
    const legacy = `<!DOCTYPE html><html><head><title>Old</title></head><body style="font-family:sans-serif"><p>Legacy body</p></body></html>`
    const out = ensureBrandedHtml(legacy)
    expect(out).toContain("linear-gradient(135deg, #0057FF")
    expect(out).toContain("<p>Legacy body</p>")
    // The old Google-fonts-less wrapper is replaced, not nested twice.
    expect(out.match(/<!DOCTYPE html>/g)?.length).toBe(1)
  })

  it("turns plain text into a branded HTML email", () => {
    const out = ensureBrandedHtml(undefined, { text: "Hi there\nSecond line" })
    expect(out).toContain("linear-gradient(135deg, #0057FF")
    expect(out).toContain("Hi there<br/>Second line")
  })
})
