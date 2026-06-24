"use client"

import { useRef, useState } from "react"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Quote,
} from "lucide-react"

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichEditor({ value, onChange, placeholder = "Write your content here..." }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [activeCommands, setActiveCommands] = useState<Set<string>>(new Set())

  const exec = (command: string, valueArg: string = "") => {
    document.execCommand(command, false, valueArg)
    editorRef.current?.focus()
    updateActiveCommands()
  }

  const updateActiveCommands = () => {
    const active = new Set<string>()
    const commands = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"]
    commands.forEach((cmd) => {
      if (document.queryCommandState(cmd)) active.add(cmd)
    })
    setActiveCommands(active)
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    updateActiveCommands()
  }

  const handleKeyUp = () => {
    updateActiveCommands()
  }

  const addLink = () => {
    const url = prompt("Enter URL:")
    if (url) exec("createLink", url)
  }

  const buttonClass = (command: string) =>
    `p-2 rounded-md transition-colors ${
      activeCommands.has(command)
        ? "bg-retail text-white"
        : "hover:bg-muted text-muted-foreground"
    }`

  return (
    <div className="border border-input rounded-md bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-input bg-muted/50">
        <button type="button" onClick={() => exec("undo")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Undo">
          <Undo className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("redo")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Redo">
          <Redo className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => exec("bold")} className={buttonClass("bold")} title="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("italic")} className={buttonClass("italic")} title="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("underline")} className={buttonClass("underline")} title="Underline">
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => exec("formatBlock", "H1")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("formatBlock", "H2")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("formatBlock", "H3")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" onClick={() => exec("insertUnorderedList")} className={buttonClass("insertUnorderedList")} title="Bullet List">
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={buttonClass("insertOrderedList")} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec("formatBlock", "blockquote")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Quote">
          <Quote className="w-4 h-4" />
        </button>
        <button type="button" onClick={addLink} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Link">
          <Link className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[300px] px-4 py-3 text-sm text-foreground outline-none prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onMouseUp={handleKeyUp}
        data-placeholder={placeholder}
        style={{ whiteSpace: "pre-wrap" }}
      />
    </div>
  )
}
