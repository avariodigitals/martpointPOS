import type { MetadataRoute } from "next"
import fs from "fs"
import path from "path"

export const dynamic = "force-static"

interface BlogPost {
  slug: string
  publishedAt: string
  status: string
}

function getBlogPosts(): BlogPost[] {
  try {
    const blogPath = path.join(process.cwd(), "data", "blog.json")
    if (!fs.existsSync(blogPath)) return []
    const data = JSON.parse(fs.readFileSync(blogPath, "utf-8"))
    return (data.posts || []).filter((p: BlogPost) => p.status === "published")
  } catch {
    return []
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://martpoint.com.ng"

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/martpoint-retail`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/martpoint-erp`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/book-demo`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/request-quote`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/industries`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/faqs`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms-of-service`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ]

  const posts = getBlogPosts()
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  // CONFIRMED: Zero admin routes. Nothing from /admin is included.
  return [...staticPages, ...blogPages]
}
