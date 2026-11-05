"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)).toUpperCase()
}

export function AdminAvatar({ name, className, fallbackClassName = "", statusDotClassName, ariaLabel }: {
  name: string
  className: string
  fallbackClassName?: string
  statusDotClassName?: string
  ariaLabel?: string
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch("/api/admin/profile/avatar", { cache: "no-store" })
        const data = await response.json()
        if (active && response.ok) setAvatarUrl(data.avatarUrl || null)
      } catch { /* Keep the initials fallback when no photo is available. */ }
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl: string | null }>).detail
      setAvatarUrl(detail?.avatarUrl || null)
    }
    void load()
    window.addEventListener("martpoint:avatar-updated", onUpdate)
    return () => { active = false; window.removeEventListener("martpoint:avatar-updated", onUpdate) }
  }, [])
  return <span role="img" aria-label={ariaLabel || `${name}'s profile photo`} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
    {avatarUrl ? <span aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${avatarUrl}")` }} /> : <span className={fallbackClassName}>{initialsOf(name)}</span>}
    {statusDotClassName && <span aria-hidden="true" className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#5365e7] ${statusDotClassName}`} />}
  </span>
}

export function ProfileAvatarUploader({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let active = true
    void fetch("/api/admin/profile/avatar", { cache: "no-store" }).then(async response => {
      const data = await response.json().catch(() => null)
      if (active && response.ok) setAvatarUrl(data?.avatarUrl || null)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  async function upload(file: File) {
    setError(""); setNotice("")
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Choose a JPG, PNG or WebP image."); return }
    if (file.size > 4 * 1024 * 1024) { setError("Choose an image smaller than 4 MB."); return }
    setPreviewUrl(URL.createObjectURL(file)); setBusy(true)
    try {
      const body = new FormData(); body.set("file", file)
      const response = await fetch("/api/admin/profile/avatar", { method: "POST", body })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Profile photo could not be saved.")
      setAvatarUrl(data.avatarUrl || null); setPreviewUrl(null); setNotice("Profile photo updated.")
      window.dispatchEvent(new CustomEvent("martpoint:avatar-updated", { detail: { avatarUrl: data.avatarUrl || null } }))
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profile photo could not be saved."); setPreviewUrl(null) }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = "" }
  }

  async function remove() {
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/profile/avatar", { method: "DELETE" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Profile photo could not be removed.")
      setAvatarUrl(null); setNotice("Profile photo removed.")
      window.dispatchEvent(new CustomEvent("martpoint:avatar-updated", { detail: { avatarUrl: null } }))
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Profile photo could not be removed.") }
    finally { setBusy(false) }
  }

  const shownUrl = previewUrl || avatarUrl
  return <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
    <span role="img" aria-label={`${name}'s profile photo preview`} className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-retail-soft text-lg font-bold text-retail ring-1 ring-inset ring-retail/20">
      {shownUrl ? <span aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${shownUrl}")` }} /> : initialsOf(name)}
    </span>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">Profile photo</p><p className="mt-1 text-xs text-slate-500">Upload a JPG, PNG or WebP image up to 4 MB.</p>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}{notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose profile photo" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-retail px-3 text-xs font-semibold text-white disabled:opacity-60"><Camera className="h-4 w-4"/>{busy ? <><Loader2 className="h-4 w-4 animate-spin"/>Saving</> : shownUrl ? "Change photo" : "Upload photo"}</button>{avatarUrl && !previewUrl && <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-60"><Trash2 className="h-4 w-4"/>Remove</button>}</div>
    </div>
  </div>
}
