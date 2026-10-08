import { describe, it, expect } from "vitest"
import { decideNextRunState } from "@/lib/automations"

const NOW = new Date("2026-10-08T12:00:00Z").getTime()

describe("decideNextRunState", () => {
  it("reschedules the next step after a successful send when steps remain", () => {
    const next = decideNextRunState({
      sent: true,
      currentStep: 1,
      maxSteps: 3,
      intervalMinutes: 2880, // 48h
      attempts: 0,
      now: NOW,
    })
    expect(next.action).toBe("reschedule")
    if (next.action === "reschedule") {
      expect(next.step).toBe(2)
      expect(new Date(next.scheduledFor).getTime() - NOW).toBe(48 * 60 * 60 * 1000)
    }
  })

  it("completes (status sent) when the final step has been sent", () => {
    const next = decideNextRunState({
      sent: true,
      currentStep: 3,
      maxSteps: 3,
      intervalMinutes: 2880,
      attempts: 0,
      now: NOW,
    })
    expect(next).toEqual({ action: "complete", status: "sent" })
  })

  it("retries a failed send with backoff without advancing the step", () => {
    const next = decideNextRunState({
      sent: false,
      currentStep: 1,
      maxSteps: 3,
      intervalMinutes: 2880,
      attempts: 0,
      now: NOW,
    })
    expect(next.action).toBe("retry")
    if (next.action === "retry") {
      expect(next.attempts).toBe(1)
      expect(new Date(next.scheduledFor).getTime() - NOW).toBe(30 * 60 * 1000)
    }
  })

  it("fails permanently once max attempts is reached", () => {
    const next = decideNextRunState({
      sent: false,
      currentStep: 1,
      maxSteps: 3,
      intervalMinutes: 2880,
      attempts: 2, // one more failure hits the 3-attempt ceiling
      now: NOW,
    })
    expect(next.action).toBe("fail")
    if (next.action === "fail") expect(next.attempts).toBe(3)
  })

  it("honours a custom maxSteps of 1 (single send completes immediately)", () => {
    const next = decideNextRunState({
      sent: true,
      currentStep: 1,
      maxSteps: 1,
      intervalMinutes: 2880,
      attempts: 0,
      now: NOW,
    })
    expect(next).toEqual({ action: "complete", status: "sent" })
  })
})
