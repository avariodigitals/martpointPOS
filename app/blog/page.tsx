import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import fs from "fs"
import path from "path"

export const metadata: Metadata = {
  title: "Blog — MartPoint",
  description: "Tips, guides, and insights for Nigerian retail businesses and enterprises.",
}

interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage: string
  category: string
  author: string
  publishedAt: string
  status: "published" | "draft"
}

function getPublishedPosts(): BlogPost[] {
  try {
    const blogPath = path.join(process.cwd(), "data", "blog.json")
    if (!fs.existsSync(blogPath)) return []
    const data = fs.readFileSync(blogPath, "utf-8")
    const posts = JSON.parse(data).posts || []
    return posts.filter((p: BlogPost) => p.status === "published")
  } catch {
    return []
  }
}

export default function BlogPage() {
  const posts = getPublishedPosts()

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background py-12 md:py-16">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Blog
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Tips & Insights for Nigerian Retailers
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Practical guides, industry news, and growth strategies for your business.
              </p>
            </div>

            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                  >
                    {post.coverImage && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <span className="text-xs font-medium text-retail">{post.category}</span>
                      <h2 className="mt-2 text-lg font-semibold text-foreground group-hover:text-retail transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{post.author}</span>
                        <span>·</span>
                        <span>
                          {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
