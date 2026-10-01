import { describe, it, expect } from "vitest"
import {
  isLive,
  mapSeverity,
  pickLive,
  buildFeedPayload,
  STATUS_PAGE_URL,
} from "@/lib/status-feed"
import type { StatusIncident } from "@/lib/status-shared"

const NOW = new Date("2026-10-01T15:00:00Z")

function inc(partial: Partial<StatusIncident>): StatusIncident {
  return {
    id: "inc-1",
    title: "Test incident",
    kind: "incident",
    status: "investigating",
    impact: "minor",
    componentIds: [],
    scheduledFor: null,
    scheduledUntil: null,
    resolvedAt: null,
    createdBy: "admin",
    createdAt: "2026-10-01T14:00:00Z",
    updatedAt: "2026-10-01T14:30:00Z",
    updates: [],
    ...partial,
  }
}

describe("isLive", () => {
  it("treats investigating/identified/monitoring/verifying incidents as live", () => {
    for (const status of ["investigating", "identified", "monitoring", "verifying"] as const) {
      expect(isLive(inc({ status }), NOW)).toBe(true)
    }
  })

  it("treats resolved/completed incidents as dead", () => {
    expect(isLive(inc({ status: "resolved" }), NOW)).toBe(false)
    expect(isLive(inc({ status: "completed" }), NOW)).toBe(false)
  })

  it("does not raise the banner for a future maintenance window", () => {
    const m = inc({
      kind: "maintenance",
      status: "scheduled",
      scheduledFor: "2026-10-05T01:00:00Z",
      scheduledUntil: "2026-10-05T03:00:00Z",
    })
    expect(isLive(m, NOW)).toBe(false)
  })

  it("raises the banner for in-progress maintenance and drops expired windows", () => {
    const active = inc({
      kind: "maintenance",
      status: "in_progress",
      scheduledFor: "2026-10-01T13:00:00Z",
      scheduledUntil: "2026-10-01T17:00:00Z",
    })
    expect(isLive(active, NOW)).toBe(true)

    const expired = inc({
      kind: "maintenance",
      status: "in_progress",
      scheduledFor: "2026-09-30T01:00:00Z",
      scheduledUntil: "2026-09-30T03:00:00Z",
    })
    expect(isLive(expired, NOW)).toBe(false)
  })
})

describe("mapSeverity", () => {
  it("maps maintenance kind to maintenance", () => {
    expect(mapSeverity(inc({ kind: "maintenance", status: "in_progress" }))).toBe("maintenance")
  })
  it("maps incident statuses onto the install whitelist", () => {
    expect(mapSeverity(inc({ status: "investigating" }))).toBe("investigating")
    expect(mapSeverity(inc({ status: "identified" }))).toBe("identified")
    expect(mapSeverity(inc({ status: "monitoring" }))).toBe("monitoring")
    expect(mapSeverity(inc({ status: "verifying" }))).toBe("monitoring")
  })
})

describe("pickLive", () => {
  it("returns null with no live incidents", () => {
    expect(pickLive([inc({ status: "resolved" })], NOW)).toBeNull()
  })

  it("prefers an incident over a live maintenance window", () => {
    const maint = inc({ id: "m", kind: "maintenance", status: "in_progress", impact: "critical" })
    const incident = inc({ id: "i", status: "investigating", impact: "none" })
    expect(pickLive([maint, incident], NOW)?.id).toBe("i")
  })

  it("prefers the highest-impact incident, then the newest", () => {
    const low = inc({ id: "low", impact: "minor", createdAt: "2026-10-01T14:50:00Z" })
    const high = inc({ id: "high", impact: "critical", createdAt: "2026-10-01T13:00:00Z" })
    const high2 = inc({ id: "high2", impact: "critical", createdAt: "2026-10-01T14:59:00Z" })
    expect(pickLive([low, high, high2], NOW)?.id).toBe("high2")
  })
})

describe("buildFeedPayload", () => {
  it("emits active:0 for the all-clear", () => {
    const payload = buildFeedPayload([], NOW)
    expect(payload.incident).toEqual({ active: 0 })
  })

  it("emits the contract shape when an incident is live", () => {
    const payload = buildFeedPayload(
      [
        inc({
          id: "abc",
          status: "identified",
          title: "Sync delays",
          updates: [
            {
              id: "u1",
              incidentId: "abc",
              status: "identified",
              body: "We are investigating a technical issue",
              createdBy: "ops",
              createdAt: "2026-10-01T14:20:00Z",
            },
          ],
        }),
      ],
      NOW
    )
    expect(payload.status).toBe("ok")
    expect(payload.incident).toMatchObject({
      active: 1,
      id: "abc",
      severity: "identified",
      message: "We are investigating a technical issue",
      url: STATUS_PAGE_URL,
      started_at: "2026-10-01T14:00:00Z",
    })
  })
})
