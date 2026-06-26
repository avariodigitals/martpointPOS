"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageUpload } from "@/components/admin/image-upload"
import { RichEditor } from "@/components/admin/rich-editor"
import { AiContentGenerator } from "@/components/admin/ai-content-generator"
import { Loader2, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AdminBlogNewPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "Retail Tips",
    author: "MartPoint Team",
    status: "draft" as "published" | "draft",
    metaDescription: "",
    keywords: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      let data: Record<string, unknown> = {}
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        console.error("Non-JSON response:", text.slice(0, 500))
        setMessage(`Server error (${res.status}). Check console for details.`)
        setSaving(false)
        return
      }

      if (res.ok && data.success) {
        router.push("/admin/blog")
      } else {
        const errorMsg = (data.error as string) || `Failed to save post (${res.status}).`
        console.error("Save error:", errorMsg, data)
        setMessage(errorMsg)
      }
    } catch (err) {
      console.error("Network or unexpected error:", err)
      setMessage("Network error. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const generateSlug = () => {
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60)
    setForm({ ...form, slug })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/blog"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Blog Post</h2>
          <p className="text-muted-foreground">Create a new blog post.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Post Details</CardTitle>
            <CardDescription>Fill in the details for your blog post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="How to Manage Inventory in a Supermarket"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="how-to-manage-inventory"
                />
                <Button type="button" variant="outline" onClick={generateSlug}>
                  Auto-generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">URL-friendly version of the title.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Short summary shown on the blog listing page..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <RichEditor
                value={form.content}
                onChange={(html) => setForm({ ...form, content: html })}
                placeholder="Write your blog post content here..."
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>AI Content Generator</CardTitle>
                <CardDescription>Generate SEO, AEO & GEO optimized content with OpenAI.</CardDescription>
              </CardHeader>
              <CardContent>
                <AiContentGenerator
                  currentTitle={form.title}
                  currentContent={form.content}
                  onGenerate={(generated) => {
                    setForm((prev) => ({
                      ...prev,
                      ...(generated.title && { title: generated.title }),
                      ...(generated.excerpt && { excerpt: generated.excerpt }),
                      ...(generated.content && { content: generated.content }),
                      ...(generated.metaDescription && { metaDescription: generated.metaDescription }),
                      ...(generated.keywords && { keywords: generated.keywords }),
                    }))
                  }}
                />
              </CardContent>
            </Card>

            <ImageUpload
              label="Cover Image"
              folder="blog"
              value={form.coverImage}
              onChange={(url) => setForm({ ...form, coverImage: url })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option>Retail Tips</option>
                  <option>POS Software</option>
                  <option>Inventory Management</option>
                  <option>Business Growth</option>
                  <option>Technology</option>
                  <option>News</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "published" | "draft" })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="MartPoint Team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Meta Description (SEO)</label>
              <textarea
                value={form.metaDescription}
                onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Description for search engines..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Keywords (SEO)</label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="supermarket, pos, inventory"
              />
            </div>
          </CardContent>
        </Card>

        {message && (
          <p className="text-sm text-red-500">{message}</p>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Post
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
