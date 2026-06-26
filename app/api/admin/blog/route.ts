import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage: string
  category: string
  author: string
  publishedAt: string
  status: "published" | "draft"
  metaDescription: string
  keywords: string
}

function mapPost(row: Record<string, unknown>): BlogPost {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    content: row.content as string,
    coverImage: row.cover_image as string,
    category: row.category as string,
    author: row.author as string,
    publishedAt: row.published_at as string,
    status: row.status as "published" | "draft",
    metaDescription: row.meta_description as string,
    keywords: row.keywords as string,
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60)
}

export async function GET() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ posts: [] })
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("[Supabase Blog GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 })
  }

  const posts = (data || []).map(mapPost)
  return NextResponse.json({ posts })
}

export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const slug = body.slug || generateSlug(body.title)

    // Check for duplicate slug
    const { data: existing } = await supabase.from("blog_posts").select("slug").eq("slug", slug).single()
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug

    const newPost = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      slug: finalSlug,
      title: body.title || "Untitled",
      excerpt: body.excerpt || "",
      content: body.content || "",
      cover_image: body.coverImage || "",
      category: body.category || "General",
      author: body.author || "MartPoint Team",
      published_at: body.publishedAt || new Date().toISOString(),
      status: body.status || "draft",
      meta_description: body.metaDescription || "",
      keywords: body.keywords || "",
    }

    const { error } = await supabase.from("blog_posts").insert(newPost)
    if (error) {
      console.error("[Supabase Blog Insert Error]", error)
      return NextResponse.json({ error: "Failed to save post" }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: mapPost(newPost) })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.slug !== undefined) updateData.slug = updates.slug
    if (updates.excerpt !== undefined) updateData.excerpt = updates.excerpt
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.coverImage !== undefined) updateData.cover_image = updates.coverImage
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.author !== undefined) updateData.author = updates.author
    if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.metaDescription !== undefined) updateData.meta_description = updates.metaDescription
    if (updates.keywords !== undefined) updateData.keywords = updates.keywords
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("blog_posts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      console.error("[Supabase Blog Update Error]", error)
      return NextResponse.json({ error: "Post not found or update failed" }, { status: 404 })
    }

    return NextResponse.json({ success: true, post: mapPost(data) })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("blog_posts").delete().eq("id", id)
    if (error) {
      console.error("[Supabase Blog Delete Error]", error)
      return NextResponse.json({ error: "Post not found or delete failed" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
