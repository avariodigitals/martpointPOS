// Each workspace owns one cache. Never persist ticket content across users or
// browser sessions, and never let an older request replace a post-update read.
export class SupportWorkspaceCache<T> {
  private entries = new Map<string, { data: T; at: number }>()
  private pending = new Map<string, Promise<T>>()

  constructor(
    private read: (id: string) => Promise<T>,
    private ttl = 30_000
  ) {}

  peek(id: string) {
    return this.entries.get(id)?.data
  }

  get(id: string, force = false): Promise<T> {
    if (!force && this.pending.has(id)) return this.pending.get(id)!
    const entry = this.entries.get(id)
    if (!force && entry && Date.now() - entry.at < this.ttl) return Promise.resolve(entry.data)
    const request = this.read(id)
      .then((data) => {
        if (this.pending.get(id) === request) {
          this.entries.delete(id)
          this.entries.set(id, { data, at: Date.now() })
          // Bound in-memory conversation retention for long-running shifts.
          if (this.entries.size > 30) this.entries.delete(this.entries.keys().next().value!)
        }
        return data
      })
      .finally(() => {
        if (this.pending.get(id) === request) this.pending.delete(id)
      })
    this.pending.set(id, request)
    return request
  }
}
