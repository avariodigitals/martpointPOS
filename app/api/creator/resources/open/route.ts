import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { openResource } from "@/lib/creator-resources"

export const dynamic = "force-dynamic"

const schema = z.object({
  resourceId: z.string().uuid(),
  kind: z.enum(["view", "download"]).default("view"),
})

export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = schema.parse(await request.json())
    const result = await openResource(creator.id, body.resourceId, body.kind)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({ url: result.url, external: result.external })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to open resource" }, { status: 500 })
  }
}
