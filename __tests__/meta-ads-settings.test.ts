import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { decryptMetaSetting, encryptMetaSetting } from "@/lib/meta-ads-settings"

describe("Meta credential encryption", () => {
  beforeEach(() => { vi.stubEnv("SESSION_SECRET", "meta-ads-test-session-secret-32-chars-minimum") })
  afterEach(() => { vi.unstubAllEnvs() })

  it("encrypts credentials at rest and decrypts them with the Central key", () => {
    const secret = "meta-app-secret-test-value"
    const encrypted = encryptMetaSetting(secret)
    expect(encrypted).not.toContain(secret)
    expect(decryptMetaSetting(encrypted)).toBe(secret)
  })

  it("rejects ciphertext modified after it was saved", () => {
    const encrypted = encryptMetaSetting("meta-app-secret-test-value")
    const parts = encrypted.split(".")
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`
    expect(() => decryptMetaSetting(parts.join("."))).toThrow()
  })
})
