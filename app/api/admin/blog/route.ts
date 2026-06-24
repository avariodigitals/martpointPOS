import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import fs from "fs"
import path from "path"

const blogPath = path.join(process.cwd(), "data", "blog.json")

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

function readBlog(): BlogPost[] {
  try {
    if (!fs.existsSync(blogPath)) return []
    const data = fs.readFileSync(blogPath, "utf-8")
    return JSON.parse(data).posts || []
  } catch {
    return []
  }
}

function writeBlog(posts: BlogPost[]) {
  try {
    const dir = path.dirname(blogPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(blogPath, JSON.stringify({ posts }, null, 2), "utf-8")
    return true
  } catch {
    return false
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

  const posts = readBlog()
  return NextResponse.json({ posts })
}

export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const posts = readBlog()

    const newPost: BlogPost = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      slug: body.slug || generateSlug(body.title),
      title: body.title || "Untitled",
      excerpt: body.excerpt || "",
      content: body.content || "",
      coverImage: body.coverImage || "",
      category: body.category || "General",
      author: body.author || "MartPoint Team",
      publishedAt: body.publishedAt || new Date().toISOString(),
      status: body.status || "draft",
      metaDescription: body.metaDescription || "",
      keywords: body.keywords || "",
    }

    // Check for duplicate slug
    if (posts.some((p) => p.slug === newPost.slug)) {
      newPost.slug = `${newPost.slug}-${Date.now().toString(36)}`
    }

    posts.unshift(newPost)
    const success = writeBlog(posts)

    if (!success) {
      return NextResponse.json({ error: "Failed to save post" }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: newPost })
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
    const posts = readBlog()

    const index = posts.findIndex((p) => p.id === body.id)
    if (index === -1) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    posts[index] = { ...posts[index], ...body }
    const success = writeBlog(posts)

    if (!success) {
      return NextResponse.json({ error: "Failed to save post" }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: posts[index] })
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

    const posts = readBlog()
    const filtered = posts.filter((p) => p.id !== id)

    if (filtered.length === posts.length) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const success = writeBlog(filtered)
    if (!success) {
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
