import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
const BUCKET = "admin-avatars"
const MAX_BYTES = 4 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } })
}

async function getAvatarPath(userId: string) {
  const { data, error } = await supabase.from("users").select("avatar_path").eq("id", userId).maybeSingle()
  if (error) throw error
  return (data?.avatar_path as string | null) || null
}

async function signedAvatarUrl(path: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) throw error
  return data.signedUrl
}

export async function GET() {
  const session = await getSession()
  if (!session) return errorResponse("Please sign in again.", 401)
  if (!isSupabaseConfigured()) return errorResponse("Profile photos are unavailable right now.", 503)
  try {
    const avatarPath = await getAvatarPath(session.userId)
    return NextResponse.json({ avatarUrl: await signedAvatarUrl(avatarPath) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[admin avatar GET]", error)
    return errorResponse("Profile photo could not load.", 503)
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return errorResponse("Please sign in again.", 401)
  if (!isSupabaseConfigured()) return errorResponse("Profile photos are unavailable right now.", 503)
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) return errorResponse("Choose an image to upload.", 400)
    const extension = MIME_EXTENSIONS[file.type]
    if (!extension) return errorResponse("Choose a JPG, PNG or WebP image.", 400)
    if (file.size < 1 || file.size > MAX_BYTES) return errorResponse("Choose an image smaller than 4 MB.", 400)

    const bytes = Buffer.from(await file.arrayBuffer())
    const validSignature = file.type === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : file.type === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    if (!validSignature) return errorResponse("That image file could not be read. Choose a JPG, PNG or WebP image.", 400)
    const path = `${session.userId}/${randomUUID()}.${extension}`
    const previousPath = await getAvatarPath(session.userId)
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const { error: updateError } = await supabase.from("users").update({ avatar_path: path }).eq("id", session.userId)
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path])
      throw updateError
    }
    if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath])
    return NextResponse.json({ success: true, avatarUrl: await signedAvatarUrl(path) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[admin avatar POST]", error)
    return errorResponse("Profile photo could not be saved. Please try again.", 503)
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return errorResponse("Please sign in again.", 401)
  if (!isSupabaseConfigured()) return errorResponse("Profile photos are unavailable right now.", 503)
  try {
    const previousPath = await getAvatarPath(session.userId)
    const { error } = await supabase.from("users").update({ avatar_path: null }).eq("id", session.userId)
    if (error) throw error
    if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath])
    return NextResponse.json({ success: true, avatarUrl: null }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[admin avatar DELETE]", error)
    return errorResponse("Profile photo could not be removed. Please try again.", 503)
  }
}
