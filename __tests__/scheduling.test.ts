import { describe, it, expect } from "vitest"
import { generateSlots, zonedTimeToUtc, normalizeScheduling, filterProposedSlots, groupSlotsByDay, DEFAULT_SCHEDULING } from "@/lib/scheduling"

describe("scheduling", () => {
  it("converts Lagos wall-clock time to UTC (UTC+1, no DST)", () => {
    expect(zonedTimeToUtc("2026-10-05", "09:00", "Africa/Lagos").toISOString()).toBe("2026-10-05T08:00:00.000Z")
  })

  it("handles DST zones", () => {
    expect(zonedTimeToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z")
    expect(zonedTimeToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z")
  })

  it("generates Mon-Fri 09:00-17:00 half-hour slots, skipping weekends, notice and busy times", () => {
    // Monday 2026-10-05 00:00 Lagos
    const now = new Date("2026-10-04T23:00:00.000Z")
    const settings = { ...DEFAULT_SCHEDULING, minNoticeHours: 0, bufferMinutes: 0, maxDaysAhead: 2 }
    const busy = [{ start: "2026-10-05T09:00:00.000Z", end: "2026-10-05T10:00:00.000Z" }] // 10:00-11:00 Lagos
    const slots = generateSlots({ settings, now, from: now, busy }).map((d) => d.toISOString())

    expect(slots[0]).toBe("2026-10-05T08:00:00.000Z") // 09:00 Lagos
    expect(slots).not.toContain("2026-10-05T09:00:00.000Z")
    expect(slots).not.toContain("2026-10-05T09:30:00.000Z")
    expect(slots).toContain("2026-10-05T10:00:00.000Z")
    expect(slots).toContain("2026-10-05T15:30:00.000Z") // 16:30 Lagos last slot
    expect(slots).not.toContain("2026-10-05T16:00:00.000Z") // 17:00 would end past window
    // Monday (16-2=14 slots) + Tuesday 16 = 30; Wednesday partially
    expect(slots.filter((s) => s.startsWith("2026-10-05")).length).toBe(14)
    expect(slots.filter((s) => s.startsWith("2026-10-06")).length).toBe(16)
  })

  it("applies minimum notice", () => {
    const now = new Date("2026-10-05T08:10:00.000Z") // Mon 09:10 Lagos
    const settings = { ...DEFAULT_SCHEDULING, minNoticeHours: 2, bufferMinutes: 0, maxDaysAhead: 1 }
    const slots = generateSlots({ settings, now }).map((d) => d.toISOString())
    expect(slots[0]).toBe("2026-10-05T10:30:00.000Z") // first slot >= 10:10Z is 10:30Z
  })

  it("respects a 60-minute duration inside 30-minute step", () => {
    const now = new Date("2026-10-04T23:00:00.000Z")
    const settings = { ...DEFAULT_SCHEDULING, minNoticeHours: 0, bufferMinutes: 0, maxDaysAhead: 1, weekly: { ...DEFAULT_SCHEDULING.weekly, mon: [{ start: "09:00", end: "10:30" }] } }
    const slots = generateSlots({ settings, now, durationMinutes: 60 }).map((d) => d.toISOString())
    expect(slots.filter((s) => s.startsWith("2026-10-05"))).toEqual(["2026-10-05T08:00:00.000Z", "2026-10-05T08:30:00.000Z"])
  })

  it("filters proposed slots by past/busy", () => {
    const now = new Date("2026-10-05T00:00:00.000Z")
    const out = filterProposedSlots(
      ["2026-10-04T10:00:00.000Z", "2026-10-06T10:00:00.000Z", "2026-10-07T10:00:00.000Z", "bad"],
      { durationMinutes: 30, now, busy: [{ start: "2026-10-06T10:15:00.000Z", end: "2026-10-06T11:00:00.000Z" }] },
    ).map((d) => d.toISOString())
    expect(out).toEqual(["2026-10-07T10:00:00.000Z"])
  })

  it("normalizes junk settings", () => {
    const s = normalizeScheduling({ slotMinutes: "abc", timezone: "Nowhere/Land", weekly: { mon: [{ start: "18:00", end: "09:00" }, { start: "09:00", end: "12:00" }] } })
    expect(s.slotMinutes).toBe(30)
    expect(s.timezone).toBe("Africa/Lagos")
    expect(s.weekly.mon).toEqual([{ start: "09:00", end: "12:00" }])
    expect(s.weekly.tue).toEqual(DEFAULT_SCHEDULING.weekly.tue)
  })

  it("groups by viewer day", () => {
    const g = groupSlotsByDay(["2026-10-05T22:30:00.000Z", "2026-10-05T23:30:00.000Z"], "Africa/Lagos")
    expect(g.map((x) => x.day)).toEqual(["2026-10-05", "2026-10-06"])
  })
})
