import { describe, it, expect, vi } from "vitest"
import { SupportWorkspaceCache } from "../lib/support-workspace-cache"

describe("support workspace cache", () => {
  it("deduplicates prefetch and selection and returns cached conversations immediately", async () => {
    const read = vi.fn(async (id: string) => ({ id }))
    const cache = new SupportWorkspaceCache(read)
    const prefetch = cache.get("ticket-a")
    expect(cache.get("ticket-a")).toBe(prefetch)
    await prefetch
    expect(cache.peek("ticket-a")).toEqual({ id: "ticket-a" })
    expect(cache.peek("ticket-b")).toBeUndefined()
    await cache.get("ticket-a")
    expect(read).toHaveBeenCalledTimes(1)
  })

  it("does not overwrite a newer post-update read with a slower earlier prefetch", async () => {
    let resolveOld!: (value: string) => void
    const read = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveOld = resolve
          })
      )
      .mockResolvedValueOnce("updated")
    const cache = new SupportWorkspaceCache<string>(read)
    const old = cache.get("ticket-a")
    expect(await cache.get("ticket-a", true)).toBe("updated")
    resolveOld("outdated")
    await old
    expect(cache.peek("ticket-a")).toBe("updated")
  })

  it("refreshes expired entries, retries failures and isolates each workspace", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce("one")
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce("two")
    const cache = new SupportWorkspaceCache<string>(read, -1)
    await cache.get("ticket-a")
    await expect(cache.get("ticket-a")).rejects.toThrow("network failed")
    expect(await cache.get("ticket-a")).toBe("two")
    expect(new SupportWorkspaceCache<string>(read).peek("ticket-a")).toBeUndefined()
  })

  it("joins a forced refresh rather than returning an older cached thread", async () => {
    let resolveUpdate!: (value: string) => void
    const read = vi
      .fn()
      .mockResolvedValueOnce("old")
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveUpdate = resolve
          })
      )
    const cache = new SupportWorkspaceCache<string>(read)
    await cache.get("ticket-a")
    const refresh = cache.get("ticket-a", true)
    expect(cache.get("ticket-a")).toBe(refresh)
    resolveUpdate("updated")
    expect(await refresh).toBe("updated")
  })

  it("bounds retained conversations during a long-running shift", async () => {
    const cache = new SupportWorkspaceCache(async (id: string) => id)
    for (let i = 0; i < 31; i++) await cache.get(`ticket-${i}`)
    expect(cache.peek("ticket-0")).toBeUndefined()
    expect(cache.peek("ticket-30")).toBe("ticket-30")
  })
})
