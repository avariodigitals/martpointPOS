import Link from "next/link"
import fs from "fs"
import path from "path"
import { ArrowRight } from "lucide-react"

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
    const posts: BlogPost[] = JSON.parse(data).posts || []
    return posts.filter((p) => p.status === "published").slice(0, 3)
  } catch {
    return []
  }
}

export function BlogPreview() {
  const posts = getPublishedPosts()

  if (posts.length === 0) return null

  return (
    <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
              Insights
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              From the Blog
            </h2>
            <p className="mt-2 text-lg text-muted-foreground max-w-xl">
              Practical tips and strategies for running a smarter retail business.
            </p>
          </div>
          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-retail hover:underline"
          >
            View all posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-border bg-background overflow-hidden transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
            >
              {post.coverImage && (
                <div className="aspect-video overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6">
                <span className="text-xs font-medium text-retail">{post.category}</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground group-hover:text-retail transition-colors line-clamp-2">
                  {post.title}
                </h3>
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

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-retail hover:underline"
          >
            View all posts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
