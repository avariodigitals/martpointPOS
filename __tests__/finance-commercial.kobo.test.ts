import { describe, it, expect } from "vitest"
import { toKobo, fromKobo, money } from "@/lib/finance-commercial"

describe("kobo money arithmetic", () => {
  it("converts NGN to integer kobo", () => {
    expect(toKobo(999.99)).toBe(99999)
    expect(toKobo(0.01)).toBe(1)
    expect(toKobo(0.019)).toBe(2)
    expect(toKobo("not a number")).toBe(0)
  })

  it("converts kobo back to NGN", () => {
    expect(fromKobo(99999)).toBe(999.99)
    expect(fromKobo(0)).toBe(0)
  })

  it("rounds away JavaScript floating-point errors", () => {
    expect(money(0.1 + 0.2)).toBe(0.3)
    expect(money(0.1 * 0.3)).toBe(0.03)
    expect(money(2.99 + 1.99)).toBe(4.98)
  })

  it("returns 0 for undefined/null input", () => {
    expect(toKobo(undefined)).toBe(0)
    expect(fromKobo(null)).toBe(0)
    expect(money(null)).toBe(0)
  })
})
