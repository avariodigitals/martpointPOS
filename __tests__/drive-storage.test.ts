import { describe, it, expect } from "vitest"
import {
  ALLOWED_DRIVE_MIME_TYPES,
  DEFAULT_DRIVE_SETTINGS,
  DRIVE_OWNER_FOLDERS,
  DRIVE_OWNER_TYPES,
  MAX_DRIVE_FILE_BYTES,
  normalizeOwnerType,
  sanitizeDriveFilename,
  sanitizeFolderSegment,
  validateDriveFile,
} from "@/lib/drive-storage"

describe("Drive owner types", () => {
  it("exposes exactly the five top-level folders the ops team asked for", () => {
    expect([...DRIVE_OWNER_TYPES]).toEqual(["business", "lead", "partner", "creator", "admin"])
    expect(DRIVE_OWNER_FOLDERS).toEqual({
      business: "Business",
      lead: "Lead",
      partner: "Partner",
      creator: "Creator",
      admin: "Admin",
    })
  })
})

describe("normalizeOwnerType", () => {
  it("accepts the canonical owner types, case- and whitespace-insensitively", () => {
    expect(normalizeOwnerType("business")).toBe("business")
    expect(normalizeOwnerType("  LEAD  ")).toBe("lead")
    expect(normalizeOwnerType("Partner")).toBe("partner")
    expect(normalizeOwnerType("creator")).toBe("creator")
    expect(normalizeOwnerType("admin")).toBe("admin")
  })

  it("resolves common aliases to the right folder", () => {
    expect(normalizeOwnerType("clients")).toBe("business")
    expect(normalizeOwnerType("customer")).toBe("business")
    expect(normalizeOwnerType("leads")).toBe("lead")
    expect(normalizeOwnerType("estimate")).toBe("lead")
    expect(normalizeOwnerType("quotation")).toBe("lead")
    expect(normalizeOwnerType("partners")).toBe("partner")
    expect(normalizeOwnerType("creators")).toBe("creator")
    expect(normalizeOwnerType("staff")).toBe("admin")
    expect(normalizeOwnerType("users")).toBe("admin")
  })

  it("rejects unknown or empty owner types", () => {
    expect(normalizeOwnerType("")).toBeNull()
    expect(normalizeOwnerType(null)).toBeNull()
    expect(normalizeOwnerType(undefined)).toBeNull()
    expect(normalizeOwnerType("underwater basket weaving")).toBeNull()
  })
})

describe("sanitizeFolderSegment", () => {
  it("keeps the UUID intact so folders map 1:1 to record IDs", () => {
    const id = "8f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8"
    expect(sanitizeFolderSegment(id)).toBe(id)
  })

  it("replaces path and glob characters so the name is a safe folder segment", () => {
    expect(sanitizeFolderSegment("a/b\\c d*e")).toBe("a_b_c_d_e")
    expect(sanitizeFolderSegment("../../etc/passwd")).toBe(".._.._etc_passwd")
  })

  it("falls back to a placeholder when nothing usable remains", () => {
    expect(sanitizeFolderSegment("")).toBe("unknown")
    expect(sanitizeFolderSegment("///")).toBe("unknown")
  })
})

describe("sanitizeDriveFilename", () => {
  it("strips characters Drive rejects but keeps the readable name", () => {
    expect(sanitizeDriveFilename("Product List <final>:v2.xlsx")).toBe("Product List finalv2.xlsx")
    expect(sanitizeDriveFilename("a/b\\c.pdf")).toBe("a-b-c.pdf")
  })

  it("trims and falls back for empty names", () => {
    expect(sanitizeDriveFilename("   ")).toBe("file")
    expect(sanitizeDriveFilename("")).toBe("file")
  })
})

describe("validateDriveFile", () => {
  it("accepts the document and image types clients actually send", () => {
    for (const type of ["image/png", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"]) {
      expect(validateDriveFile({ type, size: 1024 })).toBeNull()
    }
  })

  it("rejects unsupported types", () => {
    expect(validateDriveFile({ type: "application/x-msdownload", size: 1024 })).toMatch(/not allowed/i)
    expect(validateDriveFile({ type: "", size: 1024 })).toMatch(/not allowed/i)
  })

  it("rejects files over the size cap", () => {
    expect(validateDriveFile({ type: "application/pdf", size: MAX_DRIVE_FILE_BYTES + 1 })).toMatch(/too large/i)
    expect(validateDriveFile({ type: "application/pdf", size: MAX_DRIVE_FILE_BYTES })).toBeNull()
  })

  it("keeps the allowlist in sync with the size cap it advertises", () => {
    expect(ALLOWED_DRIVE_MIME_TYPES).toContain("application/pdf")
    expect(MAX_DRIVE_FILE_BYTES).toBe(15 * 1024 * 1024)
  })
})

describe("DEFAULT_DRIVE_SETTINGS", () => {
  it("creates a named root in My Drive and does not mirror by default", () => {
    expect(DEFAULT_DRIVE_SETTINGS).toEqual({
      rootFolderName: "MartPoint Uploads",
      rootFolderId: "",
      sharedDriveId: "",
      mirrorToSupabase: false,
    })
  })
})
