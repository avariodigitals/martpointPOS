"use client"

import { useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  Image as ImageIcon,
  ImagePlus,
  Undo2,
  Redo2,
  Heading2,
  Heading3,
  Minus,
  Loader2,
} from "lucide-react"

interface EmailRichEditorProps {
  value: string
  onChange: (html: string) => void
  /** Upload an image, return the public URL to insert. */
  onUploadImage: (file: File) => Promise<string | null>
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
        active ? "bg-retail/15 text-retail" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

export default function EmailRichEditor({ value, onChange, onUploadImage }: EmailRichEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose-sm max-w-none min-h-[220px] px-3 py-2 outline-none text-sm [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-retail [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded",
      },
    },
  })

  const setLink = () => {
    if (!editor) return
    const previous = editor.getAttributes("link").href
    const url = window.prompt("Link URL:", previous || "https://")
    if (url === null) return
    if (url === "" || url === "https://") {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }

  const pickImage = () => fileRef.current?.click()

  const insertImageUrl = () => {
    if (!editor) return
    const url = window.prompt("Image URL:", "https://")
    if (!url || url === "https://") return
    editor.chain().focus().setImage({ src: url }).run()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !editor) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-md border border-input bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolbarButton title="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Subheading" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive("heading", { level: 3 })}>
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")}>
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive("strike")}>
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")}>
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Add link" onClick={setLink} active={editor?.isActive("link")}>
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Remove link" onClick={() => editor?.chain().focus().unsetLink().run()} disabled={!editor?.isActive("link")}>
          <Link2Off className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Insert image (upload)" onClick={pickImage} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </ToolbarButton>
        <ToolbarButton title="Insert image from URL" onClick={insertImageUrl}>
          <ImagePlus className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
    </div>
  )
}
