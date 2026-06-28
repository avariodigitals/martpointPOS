"use client"

import { useState } from "react"
import { Loader2, Wand2, FileText, BookOpen, Globe, Search } from "lucide-react"

interface AiContentGeneratorProps {
  onGenerate: (content: { title?: string; excerpt?: string; content?: string; metaDescription?: string; keywords?: string }) => void
  currentTitle?: string
  currentContent?: string
}

type GenerationType = "full_post" | "excerpt" | "seo" | "aeo" | "geo"

export function AiContentGenerator({ onGenerate, currentTitle = "", currentContent = "" }: AiContentGeneratorProps) {
  const [generating, setGenerating] = useState<GenerationType | null>(null)
  const [topic, setTopic] = useState(currentTitle)
  const [error, setError] = useState("")

  const generate = async (type: GenerationType) => {
    setGenerating(type)
    setError("")

    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          topic: topic || currentTitle,
          content: currentContent,
        }),
      })

      const data = await res.json()
      if (data.success) {
        onGenerate(data.result)
      } else {
        setError(data.error || "Generation failed. Please try again.")
      }
    } catch {
      setError("Something went wrong. Check your OpenAI API key.")
    } finally {
      setGenerating(null)
    }
  }

  const buttons: { type: GenerationType; label: string; icon: typeof Wand2; desc: string }[] = [
    {
      type: "full_post",
      label: "Generate Full Post",
      icon: Wand2,
      desc: "AI writes a complete blog post with SEO, AEO & GEO optimization",
    },
    {
      type: "excerpt",
      label: "Generate Excerpt",
      icon: FileText,
      desc: "Create a compelling summary from your content",
    },
    {
      type: "seo",
      label: "Generate SEO",
      icon: Search,
      desc: "Meta description & keywords optimized for search engines",
    },
    {
      type: "aeo",
      label: "Optimize AEO",
      icon: BookOpen,
      desc: "Add Q&A sections, lists & featured snippet formats for Google/Answer Engines",
    },
    {
      type: "geo",
      label: "Optimize GEO",
      icon: Globe,
      desc: "Enhance for AI search (ChatGPT, Perplexity) with authority signals & citations",
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">AI Topic / Title</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Enter a topic for AI generation..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.type}
            type="button"
            onClick={() => generate(btn.type)}
            disabled={!!generating}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background text-left hover:border-retail/30 hover:shadow-sm transition-all disabled:opacity-50"
          >
            <div className="shrink-0 mt-0.5">
              {generating === btn.type ? (
                <Loader2 className="w-4 h-4 animate-spin text-retail" />
              ) : (
                <btn.icon className="w-4 h-4 text-retail" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{btn.label}</p>
              <p className="text-xs text-muted-foreground">{btn.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Powered by OpenAI GPT-4o. Requires <code>OPENAI_API_KEY</code> in your environment variables.
      </p>
    </div>
  )
}
