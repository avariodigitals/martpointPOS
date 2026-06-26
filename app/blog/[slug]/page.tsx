import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import fs from "fs"
import path from "path"
import { notFound } from "next/navigation"
import { ArticleSchema } from "@/components/structured-data"

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

function getPostBySlug(slug: string): BlogPost | null {
  try {
    const blogPath = path.join(process.cwd(), "data", "blog.json")
    if (!fs.existsSync(blogPath)) return null
    const data = fs.readFileSync(blogPath, "utf-8")
    const posts: BlogPost[] = JSON.parse(data).posts || []
    return posts.find((p) => p.slug === slug && p.status === "published") || null
  } catch {
    return null
  }
}

function getAllPosts(): BlogPost[] {
  try {
    const blogPath = path.join(process.cwd(), "data", "blog.json")
    if (!fs.existsSync(blogPath)) return []
    const data = fs.readFileSync(blogPath, "utf-8")
    return (JSON.parse(data).posts || []).filter((p: BlogPost) => p.status === "published")
  } catch {
    return []
  }
}

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: "Not Found" }

  return {
    title: `${post.title} — MartPoint Blog`,
    description: post.metaDescription || post.excerpt,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.metaDescription || post.excerpt,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      type: "article",
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <>
      <ArticleSchema
        title={post.title}
        description={post.metaDescription || post.excerpt}
        image={post.coverImage}
        slug={post.slug}
        publishedAt={post.publishedAt}
        author={post.author}
        keywords={post.keywords}
      />
      <Header />
      <main className="flex-1">
        <article className="w-full bg-background py-12 md:py-16">
          <div className="container-martpoint max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            {post.coverImage && (
              <div className="aspect-video rounded-xl overflow-hidden mb-8">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <span className="text-sm font-medium text-retail">{post.category}</span>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {post.title}
            </h1>

            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{post.author}</span>
              <span>·</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>

            <div
              className="mt-8 prose prose-slate max-w-none [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
