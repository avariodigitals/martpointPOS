import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { uploadCreatorFile, validateCreatorFile } from "@/lib/creator-storage"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/* Creator evidence upload — screenshots / analytics captures for submissions.
 * Scoped to submissions/<creatorId>/ so the submission API can verify
 * ownership of referenced paths. Private bucket only. */
export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const limit = await checkRateLimit(request, { key: `creator-upload:${creator.id}`, max: 20, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Too many uploads — try again later." }, { status: 429 })

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })

    const invalid = validateCreatorFile({ type: file.type, size: file.size })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const result = await uploadCreatorFile(
      `submissions/${creator.id}`,
      file.name,
      file.type,
      await file.arrayBuffer(),
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, path: result.storagePath })
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
