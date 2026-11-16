"use client"

import { useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { Extension, Node } from "@tiptap/core"
import { DOMParser as ProseMirrorDOMParser, Slice } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { htmlToText } from "@/lib/email-html"
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
  Table2,
  Loader2,
  Pilcrow,
  Eraser,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react"

interface EmailRichEditorProps {
  value: string
  onChange: (html: string) => void
  /** Upload an image, return the public URL to insert. */
  onUploadImage?: (file: File) => Promise<string | null>
  allowImages?: boolean
  /** Minimum height of the editable area in px. */
  minHeight?: number
  disabled?: boolean
}

const EmailTable = Node.create({
  name: "emailTable",
  group: "block",
  content: "emailTableRow+",
  isolating: true,
  parseHTML: () => [{ tag: "table" }],
  renderHTML: ({ HTMLAttributes }) => ["table", { ...HTMLAttributes, style: "width:100%;border-collapse:collapse;" }, ["tbody", 0]],
})

const EmailTableRow = Node.create({
  name: "emailTableRow",
  content: "(emailTableHeader | emailTableCell)+",
  parseHTML: () => [{ tag: "tr" }],
  renderHTML: ({ HTMLAttributes }) => ["tr", HTMLAttributes, 0],
})

const EmailTableCell = Node.create({
  name: "emailTableCell",
  content: "block+",
  isolating: true,
  addAttributes() {
    return {
      colspan: { default: 1, parseHTML: (element) => Number(element.getAttribute("colspan") || 1) },
      rowspan: { default: 1, parseHTML: (element) => Number(element.getAttribute("rowspan") || 1) },
    }
  },
  parseHTML: () => [{ tag: "td" }],
  renderHTML: ({ HTMLAttributes }) => ["td", { ...HTMLAttributes, style: "border:1px solid #cbd5e1;padding:8px;vertical-align:top;" }, 0],
})

const EmailTableHeader = Node.create({
  name: "emailTableHeader",
  content: "block+",
  isolating: true,
  addAttributes() {
    return {
      colspan: { default: 1, parseHTML: (element) => Number(element.getAttribute("colspan") || 1) },
      rowspan: { default: 1, parseHTML: (element) => Number(element.getAttribute("rowspan") || 1) },
    }
  },
  parseHTML: () => [{ tag: "th" }],
  renderHTML: ({ HTMLAttributes }) => ["th", { ...HTMLAttributes, style: "border:1px solid #cbd5e1;padding:8px;vertical-align:top;background:#f1f5f9;text-align:left;font-weight:600;" }, 0],
})

const EmailImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 600,
        parseHTML: (element) => {
          const width = element.getAttribute("data-email-width") || element.style.width
          if (width === "50%" || width === "300" || width === "300px") return 300
          if (width === "75%" || width === "450" || width === "450px") return 450
          return 600
        },
        renderHTML: (attributes) => {
          const width = Number(attributes.width) === 300 ? "50%" : Number(attributes.width) === 450 ? "75%" : "100%"
          return {
            width: width === "50%" ? 300 : width === "75%" ? 450 : 600,
            "data-email-width": width,
            style: `display:block;width:${width};max-width:100%;height:auto;margin:12px auto;`,
          }
        },
      },
    }
  },
})

const EmailAlignment = Extension.create({
  name: "emailAlignment",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (element) => ["left", "center", "right"].includes(element.style.textAlign) ? element.style.textAlign : null,
          renderHTML: (attributes) => ["left", "center", "right"].includes(attributes.textAlign)
            ? { style: `text-align:${attributes.textAlign};` }
            : {},
        },
      },
    }]
  },
})

function escapeTableCell(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function textTableHtml(text: string): string {
  const rows = text.split(/\r?\n/).filter((row) => row.trim()).map((row) => row.split("\t"))
  if (!rows.length || !rows.some((row) => row.length > 1)) return ""
  const columnCount = Math.max(...rows.map((row) => row.length))
  return `<table><tbody>${rows.map((row) => `<tr>${Array.from({ length: columnCount }, (_, index) => `<td><p>${escapeTableCell(row[index] || "")}</p></td>`).join("")}</tr>`).join("")}</tbody></table><p></p>`
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
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
        active ? "bg-retail/15 text-retail" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

export default function EmailRichEditor({ value, onChange, onUploadImage, allowImages = true, minHeight = 220, disabled = false }: EmailRichEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef(onUploadImage)
  const [uploading, setUploading] = useState(false)
  const [urlPanel, setUrlPanel] = useState<"link" | "image" | null>(null)
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState("")

  useEffect(() => { uploadRef.current = onUploadImage }, [onUploadImage])

  const editor = useEditor({
    extensions: [
      StarterKit,
      EmailAlignment,
      EmailTable,
      EmailTableRow,
      EmailTableHeader,
      EmailTableCell,
      ...(allowImages ? [EmailImage.configure({ inline: false })] : []),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        spellcheck: "true",
        "aria-label": "Message editor",
        class:
          "prose-sm max-w-none px-4 py-4 outline-none text-sm leading-7 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-retail [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded",
        style: `min-height:${minHeight}px`,
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData
        const imageFiles = Array.from(clipboard?.files || []).filter((file) => file.type.startsWith("image/"))
        if (imageFiles.length && uploadRef.current) {
          event.preventDefault()
          const position = view.state.selection.from
          void Promise.all(imageFiles.map(async (file) => ({
            src: await uploadRef.current?.(file),
            alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          }))).then((images) => {
            const content = images.filter((image): image is { src: string; alt: string } => Boolean(image.src))
              .map((image) => ({ type: "image", attrs: { src: image.src, alt: image.alt, width: 600 } }))
            if (content.length) editor?.commands.insertContentAt(position, content)
          })
          return true
        }
        if (!clipboard || /<table[\s>]/i.test(clipboard.getData("text/html"))) return false
        const tableHtml = textTableHtml(clipboard.getData("text/plain"))
        if (!tableHtml) return false
        const container = document.createElement("div")
        container.innerHTML = tableHtml
        const content = ProseMirrorDOMParser.fromSchema(view.state.schema).parse(container).content
        view.dispatch(view.state.tr.replaceSelection(new Slice(content, 0, 0)).scrollIntoView())
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"))
        if (!files.length || !uploadRef.current) return false
        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
        void Promise.all(files.map(async (file) => ({
          src: await uploadRef.current?.(file),
          alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        }))).then((images) => {
          const content = images.filter((image): image is { src: string; alt: string } => Boolean(image.src))
            .map((image) => ({ type: "image", attrs: { src: image.src, alt: image.alt, width: 600 } }))
          if (content.length) editor?.commands.insertContentAt(position, content)
        })
        return true
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate:false })
  }, [editor,value])

  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])

  const setLink = () => {
    if (!editor) return
    setUrl(editor.getAttributes("link").href || "https://")
    setUrlError("")
    setUrlPanel("link")
  }

  const pickImage = () => fileRef.current?.click()

  const insertImageUrl = () => {
    if (!editor) return
    setUrl("https://")
    setUrlError("")
    setUrlPanel("image")
  }

  const applyUrl = () => {
    if (!editor || disabled) return
    const value = url.trim()
    try {
      const parsed = new URL(value)
      const protocols = urlPanel === "image" ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"]
      if (!protocols.includes(parsed.protocol)) throw new Error("Unsupported URL")
      if (urlPanel === "image") editor.chain().focus().setImage({ src: value, alt: "", width: 600 }).run()
      else if (editor.state.selection.empty && !editor.isActive("link")) {
        editor.chain().focus().insertContent([{ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }]).run()
      } else editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run()
      setUrlPanel(null)
    } catch {
      setUrlError(urlPanel === "image" ? "Enter a complete http:// or https:// image URL." : "Enter a complete web, mailto: or tel: link.")
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !editor || !onUploadImage) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      if (url) {
        editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), width: 600 }).run()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20 ${disabled ? "opacity-70" : ""}`}>
      {/* Toolbar */}
      <fieldset disabled={disabled || !editor} className="border-0 p-0">
      <div role="toolbar" aria-label="Email formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-2">
        <ToolbarButton title="Normal paragraph" onClick={() => editor?.chain().focus().setParagraph().run()} active={editor?.isActive("paragraph")}>
          <Pilcrow className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Heading" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Subheading" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive("heading", { level: 3 })}>
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        {(["left", "center", "right"] as const).map((alignment) => {
          const Icon = alignment === "left" ? AlignLeft : alignment === "center" ? AlignCenter : AlignRight
          const node = editor?.isActive("heading") ? "heading" : "paragraph"
          return <ToolbarButton key={alignment} title={`Align ${alignment}`} onClick={() => editor?.chain().focus().updateAttributes(node, { textAlign: alignment }).run()} active={editor?.getAttributes(node).textAlign === alignment}><Icon className="w-4 h-4" /></ToolbarButton>
        })}
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
        <ToolbarButton title="Insert 3 × 3 table" onClick={() => editor?.chain().focus().insertContent("<table><tbody><tr><th><p>Heading</p></th><th><p>Heading</p></th><th><p>Heading</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table><p></p>").run()}>
          <Table2 className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Add link" onClick={setLink} active={editor?.isActive("link")}>
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Remove link" onClick={() => editor?.chain().focus().unsetLink().run()} disabled={!editor?.isActive("link")}>
          <Link2Off className="w-4 h-4" />
        </ToolbarButton>
        {allowImages && <><ToolbarButton title="Upload an image" onClick={pickImage} disabled={uploading || !onUploadImage}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </ToolbarButton>
        <ToolbarButton title="Insert image from URL" onClick={insertImageUrl}>
          <ImagePlus className="w-4 h-4" />
        </ToolbarButton></>}
        <span className="w-px h-4 bg-border mx-1" />
        <ToolbarButton title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
          <Eraser className="w-4 h-4" />
        </ToolbarButton>
      </div>
      {allowImages && editor?.isActive("image") && <div className="flex flex-wrap items-center gap-3 border-b bg-background px-3 py-2 text-xs">
        <span className="font-medium">Selected image</span>
        <label className="flex items-center gap-2">Width<select aria-label="Image width" className="rounded border bg-background px-2 py-1" value={Number(editor.getAttributes("image").width) === 300 ? "300" : Number(editor.getAttributes("image").width) === 450 ? "450" : "600"} onChange={(event) => editor.chain().focus().updateAttributes("image", { width: Number(event.target.value) }).run()}><option value="600">Full width</option><option value="450">Three-quarter</option><option value="300">Half width</option></select></label>
        <label className="flex min-w-[180px] flex-1 items-center gap-2">Alt text<input aria-label="Image alt text" className="min-w-0 flex-1 rounded border bg-background px-2 py-1" value={editor.getAttributes("image").alt || ""} onChange={(event) => editor.commands.updateAttributes("image", { alt: event.target.value })} placeholder="Describe the image" /></label>
      </div>}
      {urlPanel && (
        <div className="space-y-2 border-b bg-muted/20 p-3">
          <label className="block text-xs font-medium">
            {urlPanel === "image" ? "Image URL" : "Link address"}
            <input type="url" aria-label={urlPanel === "image" ? "Image URL" : "Link address"} value={url} onChange={(event) => { setUrl(event.target.value); setUrlError("") }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyUrl() } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setUrlPanel(null) } }}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          {urlError && <p role="alert" className="text-xs text-destructive">{urlError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={applyUrl} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">{urlPanel === "image" ? "Insert image" : "Apply link"}</button>
            <button type="button" onClick={() => setUrlPanel(null)} className="flex items-center gap-1 px-2 text-xs"><X className="h-3 w-3" />Cancel</button>
          </div>
        </div>
      )}
      </fieldset>

      <EditorContent editor={editor} />
      <div className="flex flex-wrap justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>Ctrl / ⌘ + B bold · I italic · Z undo</span>
        <span>{htmlToText(value).length.toLocaleString()} characters</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground"><span>Drop or paste a product photo here, or use Upload image. Images up to 4 MB.</span><button type="button" className="shrink-0 font-medium text-retail hover:underline" onClick={pickImage} disabled={disabled || uploading || !onUploadImage}>{uploading ? "Uploading…" : "Upload image"}</button></div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
    </div>
  )
}
