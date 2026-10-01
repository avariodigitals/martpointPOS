"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Search, HelpCircle } from "lucide-react"
import { CREATOR_FAQ_CATEGORY_LABELS, type CreatorFaqCategory } from "@/lib/creator-constants"
import { Card, CardContent } from "@/components/ui/card"

interface Faq {
  id: string
  question: string
  answer: string
  category: CreatorFaqCategory
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")

  const categories = useMemo(() => [...new Set(faqs.map((f) => f.category))], [faqs])
  const filtered = faqs.filter(
    (f) =>
      (category === "all" || f.category === category) &&
      (query.trim() === "" ||
        f.question.toLowerCase().includes(query.toLowerCase()) ||
        f.answer.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs…"
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All topics</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CREATOR_FAQ_CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No answers match</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <details key={f.id} className="group rounded-xl border bg-card">
              <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-sm list-none">
                <span>
                  {f.question}
                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                    {CREATOR_FAQ_CATEGORY_LABELS[f.category] || f.category}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0 ml-3" />
              </summary>
              <p className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap">{f.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
