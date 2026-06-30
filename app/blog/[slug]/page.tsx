export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { ArticleSchema } from "@/components/structured-data"
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

async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (error || !data) return null
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    coverImage: data.cover_image,
    category: data.category,
    author: data.author,
    publishedAt: data.published_at,
    status: data.status,
    metaDescription: data.meta_description,
    keywords: data.keywords,
  }
}

async function getAllPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, content, cover_image, category, author, published_at, status, meta_description, keywords")
    .eq("status", "published")

  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title || "",
    excerpt: row.excerpt || "",
    content: row.content || "",
    coverImage: row.cover_image || "",
    category: row.category || "",
    author: row.author || "",
    publishedAt: row.published_at || "",
    status: row.status,
    metaDescription: row.meta_description || "",
    keywords: row.keywords || "",
  }))
}

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: "Not Found" }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
  const coverImageUrl = post.coverImage?.startsWith("http") ? post.coverImage : `${baseUrl}${post.coverImage}`

  return {
    title: `${post.title} — MartPoint Blog`,
    description: post.metaDescription || post.excerpt,
    keywords: post.keywords,
    authors: [{ name: post.author || "MartPoint by Avario Digitals" }],
    openGraph: {
      type: "article",
      locale: "en_NG",
      siteName: "MartPoint",
      url: `${baseUrl}/blog/${post.slug}`,
      title: post.title,
      description: post.metaDescription || post.excerpt,
      publishedTime: post.publishedAt,
      authors: [post.author || "MartPoint by Avario Digitals"],
      images: post.coverImage
        ? [
            {
              url: coverImageUrl,
              secureUrl: coverImageUrl,
              width: 1200,
              height: 630,
              alt: post.title,
              type: "image/webp",
            },
          ]
        : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

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
