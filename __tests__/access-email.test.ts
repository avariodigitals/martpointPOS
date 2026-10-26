import { describe, expect, it } from "vitest"
import { accessEmailSubject, accessEmailText, recipientEmails, updateAccessMessageField, accessLink, accessMessageLinks } from "@/lib/access-email"

describe("Access email composition", () => {
  it("accepts explicit recipients separated by commas, semicolons or newlines and removes duplicates", () => {
    expect(recipientEmails(" owner@example.test; finance@example.test\nowner@example.test ")).toEqual(["owner@example.test", "finance@example.test"])
  })
  it.each(["", "invalid", "name <owner@example.test>", "owner@example.test\rBcc: other@example.test", Array(21).fill("a").map((_, i) => `a${i}@example.test`).join(",")])("rejects missing, malformed or excessive addresses", (value) => {
    expect(() => recipientEmails(value)).toThrow()
  })
  it("has a business-specific default subject and appends the separately saved note only once", () => {
    expect(accessEmailSubject("Test Business")).toContain("(Test Business)")
    expect(accessEmailText("Welcome\n", " New instruction ")).toBe("Welcome\n\nNew instruction")
    expect(accessEmailText("Welcome", "")).toBe("Welcome")
  })
  it("updates credentials while preserving the rest of an edited email, including dollar signs", () => {
    const message = "Personal greeting\nTemporary Password: old\n\nPlease call us tomorrow."
    expect(updateAccessMessageField(message, "tempPassword", "test-$&-only")).toBe("Personal greeting\nTemporary Password: test-$&-only\n\nPlease call us tomorrow.")
  })
  it("adds an optional access field missing from the previous message", () => {
    expect(updateAccessMessageField("Custom message", "onlineStoreUrl", "https://store.example.test")).toContain("Online Store: https://store.example.test")
    expect(updateAccessMessageField("Custom message", "recipients", "new@example.test")).toBe("Custom message")
  })
  it("edits additional users and support links without removing custom paragraphs", () => {
    const message = "Hi\n\nAdditional Users:\nOld user\n\nCustom paragraph\nhttps://old.example.test"
    const updated = updateAccessMessageField(message, "additionalUsers", "New user\nSecond user")
    expect(updated).toContain("Additional Users:\nNew user\nSecond user\n\nCustom paragraph")
    expect(updated).not.toContain("Old user")
    expect(updateAccessMessageField(updated, "supportGroupUrl", "https://new.example.test", "https://old.example.test")).not.toContain("https://old.example.test")
  })
  it("preserves the exact confirmed installation address without appending /login or inventing a hostname", () => {
    expect(accessLink(" https://example.com/retail/index.php/login ")).toBe("https://example.com/retail/index.php/login")
    expect(accessLink("https://example.com/custom-entry")).toBe("https://example.com/custom-entry")
    expect(accessLink("", "store", true)).toBe("")
  })
  it.each(["http:///login", "https://", "client.example.com/login", "javascript:alert(1)", "https://user:secret@example.com/login", "http://127.0.0.1/login", "https://example.com/{{login}}", "https://example.com/space here"])("rejects invalid or unsafe login address %s", (url) => {
    expect(() => accessLink(url)).toThrow()
  })
  it("keeps aliases and embedded saved links consistent while retaining personal text", () => {
    expect(accessMessageLinks("Hi\nStore / Login URL: https://old.example.com\nOpen https://old.example.com\nCustom paragraph", "https://new.example.com/pos/login", "https://old.example.com")).toBe("Hi\nSoftware URL: https://new.example.com/pos/login\nOpen https://new.example.com/pos/login\nCustom paragraph")
  })
})
