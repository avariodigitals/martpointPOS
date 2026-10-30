"use client"

import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Bold, Italic, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react"

const tools = [
  { label: "Bold", icon: Bold, command: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.chain().focus().toggleBold().run(), active: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.isActive("bold") },
  { label: "Italic", icon: Italic, command: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.chain().focus().toggleItalic().run(), active: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.isActive("italic") },
  { label: "Bulleted list", icon: List, command: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.chain().focus().toggleBulletList().run(), active: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.isActive("bulletList") },
  { label: "Numbered list", icon: ListOrdered, command: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.chain().focus().toggleOrderedList().run(), active: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.isActive("orderedList") },
  { label: "Quote", icon: Quote, command: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.chain().focus().toggleBlockquote().run(), active: (editor: NonNullable<ReturnType<typeof useEditor>>) => editor.isActive("blockquote") },
]

export function MailboxRichEditor({ value, onChange, minHeight = 220, placeholder = "Write your message…" }: { value: string; onChange: (value: string) => void; minHeight?: number; placeholder?: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "<p></p>",
    immediatelyRender: false,
    editorProps: { attributes: { class: "mailbox-rich-editor-content focus:outline-none", "data-placeholder": placeholder } },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  })

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false })
    if (editor && !value && editor.getText()) editor.commands.clearContent(true)
  }, [editor, value])

  if (!editor) return <div style={{ minHeight }} className="animate-pulse bg-slate-50" />
  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <EditorContent editor={editor} style={{ minHeight }} />
    <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
      {tools.map(({ label, icon: Icon, command, active }) => <button type="button" key={label} title={label} aria-label={label} onClick={() => command(editor)} className={`rounded-md p-2 hover:bg-white ${active(editor) ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}><Icon className="h-4 w-4" /></button>)}
      <span className="mx-1 h-5 border-l border-slate-200" />
      <button type="button" title="Undo" aria-label="Undo" onClick={() => editor.chain().focus().undo().run()} className="rounded-md p-2 text-slate-500 hover:bg-white"><Undo2 className="h-4 w-4" /></button>
      <button type="button" title="Redo" aria-label="Redo" onClick={() => editor.chain().focus().redo().run()} className="rounded-md p-2 text-slate-500 hover:bg-white"><Redo2 className="h-4 w-4" /></button>
    </div>
    <style jsx global>{`
      .mailbox-rich-editor-content { min-height: ${minHeight}px; padding: 16px; color: #1e293b; font-size: 14px; line-height: 1.7; }
      .mailbox-rich-editor-content p { margin: 0 0 0.75rem; }
      .mailbox-rich-editor-content ul { list-style: disc; padding-left: 1.5rem; }
      .mailbox-rich-editor-content ol { list-style: decimal; padding-left: 1.5rem; }
      .mailbox-rich-editor-content blockquote { border-left: 3px solid #cbd5e1; color: #64748b; margin: .75rem 0; padding-left: .75rem; }
      .mailbox-rich-editor-content p.is-editor-empty:first-child::before { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
    `}</style>
  </div>
}
