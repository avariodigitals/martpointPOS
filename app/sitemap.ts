import type { MetadataRoute } from "next"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { allIndustries } from "@/lib/industries"

interface BlogPost {
  slug: string
  publishedAt: string
  status: string
}

async function getBlogPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, published_at, status")
      .eq("status", "published")

    if (error || !data) return []
    return data.map((p) => ({ slug: p.slug, publishedAt: p.published_at, status: p.status }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://martpoint.com.ng"
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/martpoint-retail`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/martpoint-erp`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/martpoint-intelligence`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/book-demo`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/request-quote`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/industries`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/faqs`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/product-updates`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/why-martpoint`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/partners`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/customer-stories`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/careers`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/help-centre`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/download-brochure`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms-of-service`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  // Auto-discover all industry pages from lib/industries.ts
  const industryPages: MetadataRoute.Sitemap = allIndustries.map((industry) => ({
    url: `${baseUrl}/industries/${industry.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const posts = await getBlogPosts()
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  return [...staticPages, ...industryPages, ...blogPages]
}
