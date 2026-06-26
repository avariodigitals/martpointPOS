"use client"

import { useRef, useState, useEffect } from "react"
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

/* ───────────────────────────  FLOAT TOOLBAR  ─────────────────────────── */

function InlineToolbar({
  editorRef,
  onFormat,
  visible,
  position,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>
  onFormat: (cmd: string, val?: string) => void
  visible: boolean
  position: { top: number; left: number }
}) {
  const [linkUrl, setLinkUrl] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)

  if (!visible) return null

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      onFormat("createLink", linkUrl.trim())
    }
    setShowLinkInput(false)
    setLinkUrl("")
  }

  return (
    <div
      className="fixed z-[100] flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {showLinkInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="h-7 w-40 rounded border border-input bg-background px-2 text-xs outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
            autoFocus
          />
          <button
            onClick={handleLinkSubmit}
            className="rounded bg-retail px-2 py-1 text-xs font-medium text-white hover:bg-retail/90"
          >
            Add
          </button>
          <button
            onClick={() => { setShowLinkInput(false); setLinkUrl(""); editorRef.current?.focus() }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <button
            onMouseDown={(e) => { e.preventDefault(); onFormat("bold") }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onFormat("italic") }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onFormat("underline") }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Underline"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onMouseDown={(e) => { e.preventDefault(); onFormat("insertUnorderedList") }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onFormat("insertOrderedList") }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(true) }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Link"
          >
            <Link className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

/* ───────────────────────────  MAIN EDITOR  ─────────────────────────── */

export function RichEditor({ value, onChange, placeholder = "Write your content here..." }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [activeCommands, setActiveCommands] = useState<Set<string>>(new Set())
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 })

  // Apply value from parent ONLY when editor is not focused (prevents destroying selection while typing)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || ""
    }
  }, [value])

  const exec = (command: string, valueArg: string = "") => {
    editorRef.current?.focus()
    document.execCommand(command, false, valueArg)
    updateActiveCommands()
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    // Restore selection check after formatting
    setTimeout(checkSelection, 0)
  }

  const updateActiveCommands = () => {
    const active = new Set<string>()
    const commands = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"]
    commands.forEach((cmd) => {
      if (document.queryCommandState(cmd)) active.add(cmd)
    })
    setActiveCommands(active)
  }

  const checkSelection = () => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection || !editor) { setToolbarVisible(false); return }
    if (selection.isCollapsed) { setToolbarVisible(false); return }

    // Only show if selection is inside the editor
    if (!editor.contains(selection.anchorNode)) { setToolbarVisible(false); return }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()

    // Center toolbar above selection
    const toolbarWidth = 260
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - toolbarWidth / 2, editorRect.left + 8),
      editorRect.right - toolbarWidth - 8
    )
    setToolbarPos({ top: rect.top - 48, left })
    setToolbarVisible(true)
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    updateActiveCommands()
    checkSelection()
  }

  const handleKeyUp = () => {
    updateActiveCommands()
    checkSelection()
  }
  const handleMouseUp = () => {
    updateActiveCommands()
    setTimeout(checkSelection, 0)
  }

  const handleBlur = () => {
    // Delay hiding so toolbar clicks register before it disappears
    setTimeout(() => {
      const activeEl = document.activeElement
      const toolbarEl = document.querySelector('[data-inline-toolbar="true"]')
      if (toolbarEl?.contains(activeEl)) return
      setToolbarVisible(false)
    }, 150)
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

      {/* Inline Floating Toolbar */}
      <InlineToolbar
        editorRef={editorRef}
        onFormat={exec}
        visible={toolbarVisible}
        position={toolbarPos}
      />

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[300px] px-4 py-3 text-sm text-foreground outline-none prose prose-sm max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onMouseUp={handleMouseUp}
        onBlur={handleBlur}
        data-placeholder={placeholder}
      />
    </div>
  )
}
