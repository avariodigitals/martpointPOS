"use client"

import { useState } from "react"
import { Plus, Trash2, Wand2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FaqItem {
  question: string
  answer: string
}

interface FaqEditorProps {
  value: FaqItem[]
  onChange: (faqs: FaqItem[]) => void
}

export function parseFaqText(text: string): FaqItem[] {
  const items: FaqItem[] = []
  let current: FaqItem | null = null

  const push = () => {
    if (current && current.question) items.push(current)
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim()
    if (!line) continue

    const qMatch = line.match(/^Q(?:uestion)?\s*[.:)]\s*(.+)$/i)
    const aMatch = line.match(/^A(?:nswer)?\s*[.:)]\s*(.+)$/i)

    if (qMatch) {
      push()
      current = { question: qMatch[1].trim(), answer: "" }
    } else if (aMatch) {
      if (!current) current = { question: "", answer: "" }
      current.answer = [current.answer, aMatch[1].trim()].filter(Boolean).join(" ")
    } else if (line.endsWith("?")) {
      push()
      current = { question: line, answer: "" }
    } else if (current) {
      current.answer = [current.answer, line].filter(Boolean).join(" ")
    }
  }
  push()
  return items
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs
      .filter((f) => f.question && f.answer)
      .map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
  }
}

export function FaqEditor({ value, onChange }: FaqEditorProps) {
  const [pasteText, setPasteText] = useState("")
  const [parseMessage, setParseMessage] = useState("")
  const [showSchema, setShowSchema] = useState(false)

  const updateItem = (index: number, patch: Partial<FaqItem>) => {
    onChange(value.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleParse = () => {
    const parsed = parseFaqText(pasteText)
    if (parsed.length === 0) {
      setParseMessage("No questions detected. Use 'Q: ...' / 'A: ...' lines or questions ending with '?'.")
      return
    }
    onChange([...value, ...parsed])
    setPasteText("")
    setParseMessage(`${parsed.length} FAQ${parsed.length === 1 ? "" : "s"} added.`)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">FAQs (optional — adds FAQPage schema)</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { question: "", answer: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add FAQ
        </Button>
      </div>

      <div className="rounded-md border border-dashed border-input p-3 space-y-2">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={"Paste FAQ content here, e.g.\nQ: What is MartPoint?\nA: A POS and ERP platform for African retailers.\n\nOr just:\nWhat is MartPoint?\nA POS and ERP platform for African retailers."}
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={handleParse} disabled={!pasteText.trim()}>
            <Wand2 className="mr-1 h-3.5 w-3.5" />
            Convert to FAQs
          </Button>
          {parseMessage && <p className="text-xs text-muted-foreground">{parseMessage}</p>}
        </div>
      </div>

      {value.map((faq, i) => (
        <div key={i} className="rounded-md border border-input p-3 space-y-2">
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={faq.question}
              onChange={(e) => updateItem(i, { question: e.target.value })}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Question"
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-red-500 transition-colors"
              title="Remove FAQ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={faq.answer}
            onChange={(e) => updateItem(i, { answer: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Answer"
          />
        </div>
      ))}

      {value.some((f) => f.question && f.answer) && (
        <div>
          <button
            type="button"
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSchema ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showSchema ? "Hide" : "Preview"} FAQPage JSON-LD schema
          </button>
          {showSchema && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-input bg-muted/50 p-3 text-xs">
              {JSON.stringify(buildFaqSchema(value), null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
