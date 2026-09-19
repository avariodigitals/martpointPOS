import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImage: string
  coverImageAlt: string
  category: string
  author: string
  publishedAt: string
  status: "published" | "draft"
  metaDescription: string
  primaryKeywords: string
  secondaryKeywords: string
  faqs: Array<{ question: string; answer: string }>
}

function mapPost(row: Record<string, unknown>): BlogPost {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    content: row.content as string,
    coverImage: row.cover_image as string,
    coverImageAlt: (row.cover_image_alt as string) || "",
    category: row.category as string,
    author: row.author as string,
    publishedAt: row.published_at as string,
    status: row.status as "published" | "draft",
    metaDescription: row.meta_description as string,
    primaryKeywords: (row.primary_keywords as string) || (row.keywords as string) || "",
    secondaryKeywords: (row.secondary_keywords as string) || "",
    faqs: Array.isArray(row.faqs) ? (row.faqs as Array<{ question: string; answer: string }>) : [],
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60)
}

// Blog pages are statically rendered with a long ISR window — purge them
// on every mutation so changes are visible immediately.
function revalidateBlog(slugs: Array<string | undefined | null>) {
  try {
    revalidatePath("/blog")
    revalidatePath("/sitemap.xml")
    for (const slug of slugs) {
      if (slug) revalidatePath(`/blog/${slug}`)
    }
  } catch (err) {
    console.error("[Blog Revalidate Error]", err)
  }
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
      cover_image_alt: body.coverImageAlt || "",
      category: body.category || "General",
      author: body.author || "MartPoint Team",
      published_at: body.publishedAt || new Date().toISOString(),
      status: body.status || "draft",
      meta_description: body.metaDescription || "",
      primary_keywords: body.primaryKeywords || body.keywords || "",
      secondary_keywords: body.secondaryKeywords || "",
      keywords: body.primaryKeywords || body.keywords || "",
      faqs: Array.isArray(body.faqs) ? body.faqs : [],
    }

    const { error } = await supabase.from("blog_posts").insert(newPost)
    if (error) {
      console.error("[Supabase Blog Insert Error]", error)
      return NextResponse.json({ error: "Failed to save post" }, { status: 500 })
    }

    revalidateBlog([newPost.slug])
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

    const { data: existingPost } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("id", id)
      .single()

    const updateData: Record<string, unknown> = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.slug !== undefined) updateData.slug = updates.slug
    if (updates.excerpt !== undefined) updateData.excerpt = updates.excerpt
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.coverImage !== undefined) updateData.cover_image = updates.coverImage
    if (updates.coverImageAlt !== undefined) updateData.cover_image_alt = updates.coverImageAlt
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.author !== undefined) updateData.author = updates.author
    if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.metaDescription !== undefined) updateData.meta_description = updates.metaDescription
    if (updates.primaryKeywords !== undefined) {
      updateData.primary_keywords = updates.primaryKeywords
      updateData.keywords = updates.primaryKeywords
    }
    if (updates.secondaryKeywords !== undefined) updateData.secondary_keywords = updates.secondaryKeywords
    if (updates.faqs !== undefined) updateData.faqs = Array.isArray(updates.faqs) ? updates.faqs : []
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

    revalidateBlog([existingPost?.slug, data.slug])
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

    const { data: existingPost } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("blog_posts").delete().eq("id", id)
    if (error) {
      console.error("[Supabase Blog Delete Error]", error)
      return NextResponse.json({ error: "Post not found or delete failed" }, { status: 404 })
    }

    revalidateBlog([existingPost?.slug])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
