import { describe, expect, it } from "vitest"
import { brandedEmailHtml, ensureBrandedHtml } from "../lib/email-templates"

describe("brandedEmailHtml", () => {
  it("wraps a body fragment in the MartPoint shell", () => {
    const html = brandedEmailHtml("<p>Hello world</p>", { title: "Test" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("background:linear-gradient(135deg, #0057FF")
    expect(html).toContain("alt=\"MartPoint\"")
    expect(html).toContain("<p>Hello world</p>")
    expect(html).toContain("MartPoint &middot; martpoint.com.ng")
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
