import { describe, it, expect } from "vitest"
import {
  GOOGLE_DRIVE_SCOPE,
  canUseDrive,
  grantedScopesUnknown,
  hasGrantedScopes,
  isGoogleConnected,
  type GoogleSettings,
} from "@/lib/google-calendar"

/* ─────────────────────────────────────────────────────────────────────────────
 * The bug these tests exist to prevent: Settings said "Google Drive connected"
 * while every upload failed with 403 "insufficient authentication scopes",
 * because the refresh token predated the drive.file scope. A refresh token
 * alone must never be treated as "Drive works".
 * ──────────────────────────────────────────────────────────────────────────── */

const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ")

function settings(overrides: Partial<GoogleSettings> = {}): GoogleSettings {
  return {
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    email: "ops@example.com",
    connectedAt: "2026-01-01T00:00:00.000Z",
    calendarId: "primary",
    grantedScopes: "",
    ...overrides,
  }
}

describe("hasGrantedScopes", () => {
  it("is true only when every required scope was granted", () => {
    const s = settings({ grantedScopes: `${CALENDAR_SCOPES} ${GOOGLE_DRIVE_SCOPE}` })
    expect(hasGrantedScopes(s, [GOOGLE_DRIVE_SCOPE])).toBe(true)
    expect(hasGrantedScopes(s, ["openid", GOOGLE_DRIVE_SCOPE])).toBe(true)
  })

  it("is false when the Drive scope is missing", () => {
    const s = settings({ grantedScopes: CALENDAR_SCOPES })
    expect(hasGrantedScopes(s, [GOOGLE_DRIVE_SCOPE])).toBe(false)
  })

  it("tolerates extra whitespace and newlines in the granted list", () => {
    const s = settings({ grantedScopes: `  ${CALENDAR_SCOPES}\n  ${GOOGLE_DRIVE_SCOPE}  ` })
    expect(hasGrantedScopes(s, [GOOGLE_DRIVE_SCOPE])).toBe(true)
  })
})

describe("canUseDrive — the regression that shipped", () => {
  it("is FALSE for the exact production case: connected, calendar scopes only", () => {
    const s = settings({ grantedScopes: CALENDAR_SCOPES })
    // The old check (`isDriveReady` == has refresh token) returned true here,
    // which is precisely why Settings claimed it was connected.
    expect(isGoogleConnected(s)).toBe(true)
    expect(canUseDrive(s)).toBe(false)
  })

  it("is TRUE once drive.file has been granted", () => {
    expect(canUseDrive(settings({ grantedScopes: `${CALENDAR_SCOPES} ${GOOGLE_DRIVE_SCOPE}` }))).toBe(true)
  })

  it("is false when no account is connected at all", () => {
    expect(canUseDrive(settings({ refreshToken: "", grantedScopes: "" }))).toBe(false)
  })

  it("is false when the account is connected but scopes were never recorded", () => {
    // Unknown is treated as not-ready so the admin is prompted to reconnect
    // rather than shown a false positive.
    expect(canUseDrive(settings({ grantedScopes: "" }))).toBe(false)
  })

  it("is false when Google is configured but not connected", () => {
    expect(canUseDrive(settings({ refreshToken: "" }))).toBe(false)
  })
})

describe("grantedScopesUnknown", () => {
  it("flags a pre-scope-tracking connection so the UI can explain the gap", () => {
    expect(grantedScopesUnknown(settings({ grantedScopes: "" }))).toBe(true)
    expect(grantedScopesUnknown(settings({ grantedScopes: CALENDAR_SCOPES }))).toBe(false)
  })

  it("is false when nothing is connected", () => {
    expect(grantedScopesUnknown(settings({ refreshToken: "", grantedScopes: "" }))).toBe(false)
  })
})
