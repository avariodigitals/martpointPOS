import { describe, it, expect, vi, beforeEach } from "vitest"

/* ─────────────────────────────────────────────────────────────────────────────
 * The client onboarding page is PUBLIC, so its uploads must not go through the
 * admin-only Drive endpoint (that returns 401 for a client with no session) and
 * must not let a caller choose which tenant the file is filed against.
 *
 * These tests pin the security-relevant behaviour of /api/onboarding/upload:
 *   • the owner is resolved FROM THE RECORD, never from the request body
 *   • an unknown / finalised record never reaches Drive
 *   • an unlinked record returns 409 rather than guessing a folder
 * ──────────────────────────────────────────────────────────────────────────── */

const ensureOwnerFolder = vi.fn()
const uploadFileToFolder = vi.fn()
const fromMock = vi.fn()

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

vi.mock("@/lib/drive-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/drive-storage")>("@/lib/drive-storage")
  return {
    ...actual,
    ensureOwnerFolder: (...args: unknown[]) => ensureOwnerFolder(...args),
    uploadFileToFolder: (...args: unknown[]) => uploadFileToFolder(...args),
  }
})

import { POST } from "@/app/api/onboarding/upload/route"

function makeForm(fields: Record<string, string>, files: File[] = []) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  for (const f of files) form.append("file", f)
  return form
}

function post(form: FormData) {
  return POST(new Request("http://localhost/api/onboarding/upload", { method: "POST", body: form }))
}

/** Minimal chainable Supabase query stub keyed by table name. */
function dbStub(tables: Record<string, { data: unknown; error?: unknown }>) {
  return (table: string) => {
    const result = tables[table] ?? { data: null }
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.single = async () => result
    chain.maybeSingle = async () => result
    return chain
  }
}

const FILE = () => new File([new Uint8Array([1, 2, 3])], "products.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})

beforeEach(() => {
  vi.clearAllMocks()
  ensureOwnerFolder.mockResolvedValue({ folderId: "folder-1", webViewLink: "https://drive/folder-1" })
  uploadFileToFolder.mockResolvedValue({ ok: true, fileId: "file-1", name: "products.xlsx", webViewLink: "https://drive/file-1" })
})

describe("onboarding upload — owner resolution", () => {
  it("files under Business/<business_id> taken from the record, ignoring any body owner", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-1", lead_id: "lead-1", business_id: "biz-1", status: "Pending" } } }))

    // A caller tries to redirect the upload to someone else's business.
    const form = makeForm({ onboardingId: "ob-1", ownerId: "victim-biz", businessId: "victim-biz" }, [FILE()])
    const res = await post(form)

    expect(res.status).toBe(200)
    expect(ensureOwnerFolder).toHaveBeenCalledWith("business", "biz-1")
    // The attacker-supplied ids must never be used.
    expect(ensureOwnerFolder).not.toHaveBeenCalledWith("business", "victim-biz")
  })

  it("falls back to Lead/<lead_id> while the business is not linked yet", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-2", lead_id: "lead-2", business_id: null, status: "Pending" } }, businesses: { data: null } }))

    const res = await post(makeForm({ onboardingId: "ob-2" }, [FILE()]))

    expect(res.status).toBe(200)
    expect(ensureOwnerFolder).toHaveBeenCalledWith("lead", "lead-2")
  })

  it("looks the business up by lead when the record only carries a lead id", async () => {
    fromMock.mockImplementation(
      dbStub({
        onboarding: { data: { id: "ob-3", lead_id: "lead-3", business_id: null, status: "Pending" } },
        businesses: { data: { id: "biz-3" } },
      })
    )

    const res = await post(makeForm({ onboardingId: "ob-3" }, [FILE()]))

    expect(res.status).toBe(200)
    expect(ensureOwnerFolder).toHaveBeenCalledWith("business", "biz-3")
  })

  it("returns 409 and never touches Drive when nothing is linked", async () => {
    fromMock.mockImplementation(
      dbStub({ onboarding: { data: { id: "ob-4", lead_id: null, business_id: null, status: "Pending" } } })
    )

    const res = await post(makeForm({ onboardingId: "ob-4" }, [FILE()]))

    expect(res.status).toBe(409)
    expect(ensureOwnerFolder).not.toHaveBeenCalled()
    expect(uploadFileToFolder).not.toHaveBeenCalled()
  })
})

describe("onboarding upload — validation", () => {
  it("rejects a missing onboardingId", async () => {
    const res = await post(makeForm({}))
    expect(res.status).toBe(400)
    expect(ensureOwnerFolder).not.toHaveBeenCalled()
  })

  it("404s an unknown record", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: null } }))
    const res = await post(makeForm({ onboardingId: "nope" }, [FILE()]))
    expect(res.status).toBe(404)
  })

  it("refuses to accept uploads for an already-finalised onboarding", async () => {
    for (const status of ["Completed", "Rejected"]) {
      fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-5", lead_id: "lead-5", business_id: "biz-5", status } } }))
      const res = await post(makeForm({ onboardingId: "ob-5" }, [FILE()]))
      expect(res.status).toBe(400)
      expect(ensureOwnerFolder).not.toHaveBeenCalled()
    }
  })

  it("rejects a disallowed file type before calling Drive", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-6", lead_id: "lead-6", business_id: "biz-6", status: "Pending" } } }))
    const exe = new File([new Uint8Array([1])], "virus.exe", { type: "application/x-msdownload" })

    const res = await post(makeForm({ onboardingId: "ob-6" }, [exe]))

    expect(res.status).toBe(400)
    expect(uploadFileToFolder).not.toHaveBeenCalled()
  })

  it("rejects an empty upload", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-7", lead_id: "lead-7", business_id: "biz-7", status: "Pending" } } }))
    const res = await post(makeForm({ onboardingId: "ob-7" }))
    expect(res.status).toBe(400)
  })
})

describe("onboarding upload — success payload", () => {
  it("returns the Drive link so the client can reference it", async () => {
    fromMock.mockImplementation(dbStub({ onboarding: { data: { id: "ob-8", lead_id: "lead-8", business_id: "biz-8", status: "Pending" } } }))

    const res = await post(makeForm({ onboardingId: "ob-8" }, [FILE()]))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.uploaded[0]).toMatchObject({ name: "products.xlsx", fileId: "file-1", link: "https://drive/file-1" })
  })
})
