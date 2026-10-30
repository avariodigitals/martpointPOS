"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowLeft, ArchiveRestore, Check, ChevronDown, CircleUserRound, Inbox, Mail, MailOpen, MoreVertical, Paperclip, Pencil, Plus, Search, Send, Settings2, Star, Trash2, X } from "lucide-react"
import EmailRichEditor from "@/components/admin/email-rich-editor"
import { escapeHtml, htmlToText } from "@/lib/email-html"

type Mailbox = { id: string; name: string; email: string; active: boolean; canManage: boolean; memberCount: number; last_sync_at?: string | null; last_sync_error?: string | null }
type StaffUser = { id: string; name: string; email: string; username: string; role: string }
type MailLabel = { id: string; name: string; color: string }
type Thread = { id: string; mailbox_id: string; subject: string; participants: string[]; status: string; is_starred: boolean; assigned_to: string | null; last_message_at: string; last_message_preview: string; unread: boolean; last_direction: string; lead_id?: string | null; labels?: MailLabel[]; draftId?: string; draftThreadId?: string | null; draft?: DraftData }
type DraftData = { to: string; cc: string; subject: string; body: string; showCc?: boolean }
type Message = { id: string; direction: "inbound" | "outbound"; from_email: string; from_name: string; to_emails: string[]; cc_emails: string[]; subject: string; body_text: string; body_html: string; send_status: string; sent_by_name?: string; created_at: string; attachment_names: string[]; attachments?: { id: string; filename: string; size: number }[] }
type Folder = "inbox" | "sent" | "starred" | "assigned" | "closed" | "deleted" | "drafts"

const folders: { id: Folder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox }, { id: "sent", label: "Sent emails", icon: Send },
  { id: "starred", label: "Starred", icon: Star }, { id: "assigned", label: "Assigned to me", icon: CircleUserRound },
  { id: "closed", label: "Archived", icon: Archive }, { id: "drafts", label: "Drafts", icon: Pencil }, { id: "deleted", label: "Deleted", icon: Trash2 },
]

function initials(value: string) { return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?" }
function displayName(value: string) { return value.replace(/<[^>]+>/, "").trim() || value }
function formatTime(value: string) { const date = new Date(value); const now = new Date(); return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString([], { day: "numeric", month: "short" }) }
function messageHtml(message: Message) { return message.body_html || `<div style="white-space:pre-wrap">${message.body_text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c))}</div>` }
function martPointSignatureHtml(team: string, email: string, assetOrigin: string) {
  const safeTeam = escapeHtml(team.trim() || "MartPoint Team")
  const safeEmail = escapeHtml(email.trim())
  const logoUrl = `${assetOrigin}/logo-white.png`
  const bannerUrl = `${assetOrigin}/footerbanner.png`
  return `<div style="max-width:1000px;padding-right:10px;border-right:3px solid #3678ff;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.4">
    <div style="margin:0 0 4px;font-size:32px;font-weight:bold;color:#120b79">Best Regards</div>
    <div style="padding-bottom:8px;border-bottom:1px solid #4c94a0;font-size:20px;color:#3678f5">MartPoint ${safeTeam} | <a href="https://martpoint.com.ng" style="color:#120b79;text-decoration:none;font-weight:bold">www.martpoint.com.ng</a></div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr>
      <td width="180" valign="middle" style="padding:0 24px 0 0"><a href="https://martpoint.com.ng" style="display:block;width:145px;height:145px;padding:12px;background-color:#204cf2;text-align:center"><img src="${logoUrl}" width="140" alt="MartPoint" style="display:block;width:140px;height:auto;margin-top:50px" /></a></td>
      <td valign="middle" style="font-size:19px;line-height:1.55;color:#111827"><div><strong style="color:#3678f5">T:</strong> <a href="tel:+2348036028069" style="color:#111827;text-decoration:none">08036028069</a></div><div><strong style="color:#3678f5">M:</strong> <a href="https://wa.me/2348037978230" style="color:#111827;text-decoration:none">08037978230</a></div><div><strong style="color:#3678f5">E:</strong> <a href="mailto:${safeEmail}" style="color:#3678f5">${safeEmail}</a></div><div><strong style="color:#3678f5">A:</strong> MartPoint, Ikeja, Lagos, Nigeria</div>
      <div style="margin-top:10px;font-size:14px"><a href="https://facebook.com/usemartpoint" style="color:#3678f5">Facebook</a> &nbsp; <a href="https://www.youtube.com/@usemartpoint" style="color:#e32620">YouTube</a> &nbsp; <a href="https://www.linkedin.com/company/usemartpoint" style="color:#2875a9">LinkedIn</a> &nbsp; <a href="https://instagram.com/usemartpoint" style="color:#8751a2">Instagram</a> &nbsp; <a href="https://www.tiktok.com/@usemartpoint" style="color:#111827">TikTok</a></div></td>
    </tr></table>
    <div style="margin-top:28px"><a href="https://martpoint.com.ng" style="text-decoration:none"><img src="${bannerUrl}" width="1000" alt="One Platform. Every Business." style="display:block;width:100%;max-width:1000px;height:auto" /></a></div>
    <div style="margin-top:24px;color:#929292;font-size:14px;line-height:1.25">The content of this email is confidential and intended for the recipient specified in the message only. It is strictly forbidden to share any part of this message with any third party, without a written consent from the sender. If you received this message by mistake, please reply to this message and follow with its deletion, so that we can ensure such a mistake does not occur in the future.</div>
  </div>`
}

export default function MailboxPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [labels, setLabels] = useState<MailLabel[]>([])
  const [labelFilter, setLabelFilter] = useState("")
  const [addingLabel, setAddingLabel] = useState(false)
  const [labelName, setLabelName] = useState("")
  const [labelColor, setLabelColor] = useState("#0f766e")
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [mailboxId, setMailboxId] = useState("")
  const [folder, setFolder] = useState<Folder>("inbox")
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [selected, setSelected] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [compose, setCompose] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [draftId, setDraftId] = useState("")
  const [savingDraft, setSavingDraft] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSyncing, setSettingsSyncing] = useState(false)
  const [settingsSyncMessage, setSettingsSyncMessage] = useState("")
  const [signaturePreview, setSignaturePreview] = useState(false)
  const [editingMailboxId, setEditingMailboxId] = useState("")
  const [mailboxPickerOpen, setMailboxPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [mobileView, setMobileView] = useState<"folders" | "list" | "thread">("list")
  const [config, setConfig] = useState({ name: "", email: "", imapHost: "", imapPort: "993", imapUser: "", imapPassword: "", imapFolder: "INBOX", imapSecure: true, signatureFormat: "html" as "plain" | "html", signatureHtml: "", members: [] as string[] })
  const hasLoadedThreads = useRef(false)
  const requestSequence = useRef(0)
  const draftIdRef = useRef("")
  const draftThreadIdRef = useRef<string | null>(null)
  const draftTimerRef = useRef<number | null>(null)
  const setCurrentDraftId = (value: string) => { draftIdRef.current = value; setDraftId(value) }

  const selectedMailbox = mailboxes.find((mailbox) => mailbox.id === mailboxId)
  const visibleThreads = useMemo(() => {
    const filtered = labelFilter ? threads.filter((thread) => thread.labels?.some((label) => label.id === labelFilter)) : threads
    return folder === "drafts" && query.trim() ? filtered.filter((thread) => `${thread.subject} ${thread.draft?.to || ""} ${thread.draft?.cc || ""} ${htmlToText(thread.draft?.body || "")}`.toLowerCase().includes(query.trim().toLowerCase())) : filtered
  }, [threads, labelFilter, folder, query])
  const loadLabels = useCallback(async () => {
    if (!mailboxId) { setLabels([]); return }
    try {
      const response = await fetch(`/api/admin/mailboxes/${mailboxId}/labels`, { cache: "no-store" })
      const data = await response.json()
      if (response.ok) setLabels(data.labels || [])
    } catch { /* keep the reader usable if labels cannot load */ }
  }, [mailboxId])
  const loadMailboxRoster = useCallback(async () => {
    if (!mailboxId) { setStaff([]); return }
    try {
      const response = await fetch(`/api/admin/mailboxes?mailboxId=${encodeURIComponent(mailboxId)}`, { cache: "no-store" })
      const data = await response.json()
      if (response.ok) setStaff(data.users || [])
    } catch { /* assignment options can be reloaded after a mailbox switch */ }
  }, [mailboxId])
  const loadMailboxes = useCallback(async () => {
    const response = await fetch("/api/admin/mailboxes", { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Could not load mailboxes.")
    setMailboxes(data.mailboxes || []); setStaff(data.users || []); setIsAdmin(Boolean(data.isAdmin))
    setMailboxId((current) => current && data.mailboxes?.some((item: Mailbox) => item.id === current) ? current : data.mailboxes?.[0]?.id || "")
  }, [])

  const loadThreads = useCallback(async () => {
    if (!mailboxId) { setThreads([]); setLoading(false); return }
    const sequence = ++requestSequence.current
    if (!hasLoadedThreads.current) setLoading(true)
    try {
      const endpoint = folder === "drafts" ? `/api/admin/mailboxes/${mailboxId}/drafts` : `/api/admin/mailboxes/${mailboxId}/threads?${new URLSearchParams({ folder, q: query })}`
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load conversations.")
      if (sequence === requestSequence.current) {
        setThreads(folder === "drafts" ? (data.drafts || []).map((draft: { id: string; mailbox_id: string; thread_id: string | null; draft: DraftData; updated_at: string }) => ({ id: draft.id, draftId: draft.id, draftThreadId: draft.thread_id, draft: draft.draft, mailbox_id: draft.mailbox_id, subject: draft.draft.subject || "(no subject)", participants: draft.draft.to ? [draft.draft.to] : [], status: "draft", is_starred: false, assigned_to: null, last_message_at: draft.updated_at, last_message_preview: htmlToText(draft.draft.body || "").slice(0, 180) || "Draft", unread: false, last_direction: "outbound" })) : (data.threads || []))
        hasLoadedThreads.current = true
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load conversations.") }
    finally { if (sequence === requestSequence.current) setLoading(false) }
  }, [mailboxId, folder, query])

  const loadThread = useCallback(async (id: string) => {
    if (!id || !mailboxId) return
    try {
      const response = await fetch(`/api/admin/mailboxes/${mailboxId}/threads/${id}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not open this conversation.")
      setSelected(data.thread); setMessages(data.messages || [])
      setThreads((current) => current.map((thread) => thread.id === id ? { ...thread, unread: false } : thread))
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open this conversation.") }
  }, [mailboxId])

  useEffect(() => { loadMailboxes().catch((error) => setNotice(error.message)) }, [loadMailboxes])
  useEffect(() => { loadLabels() }, [loadLabels])
  useEffect(() => { loadMailboxRoster() }, [loadMailboxRoster])
  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => { if (selectedId) loadThread(selectedId) }, [selectedId, loadThread])
  useEffect(() => { hasLoadedThreads.current = false }, [mailboxId, folder])
  useEffect(() => {
    if (!mailboxId) return
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") { loadThreads(); if (selectedId && folder !== "drafts") loadThread(selectedId) } }, 30000)
    return () => window.clearInterval(timer)
  }, [mailboxId, folder, selectedId, loadThreads, loadThread])

  useEffect(() => {
    if (!compose || !mailboxId || (!to.trim() && !cc.trim() && !subject.trim() && !htmlToText(body).trim())) return
    const timer = window.setTimeout(async () => {
      draftTimerRef.current = null
      setSavingDraft(true)
      try {
        const response = await fetch(`/api/admin/mailboxes/${mailboxId}/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draftIdRef.current || undefined, draft: { to, cc, subject, body, showCc }, threadId: selected?.id || draftThreadIdRef.current || null }) })
        const data = await response.json()
        if (response.ok && data.draft?.id) setCurrentDraftId(data.draft.id)
      } catch { /* autosave is best effort; manual Save draft remains available */ }
      finally { setSavingDraft(false) }
    }, 900)
    draftTimerRef.current = timer
    return () => { window.clearTimeout(timer); if (draftTimerRef.current === timer) draftTimerRef.current = null }
  }, [compose, mailboxId, to, cc, subject, body, showCc, selected?.id])

  const chooseFolder = (value: Folder) => { setFolder(value); if (value === "drafts") setLabelFilter(""); setMobileView("list"); setSelectedId(""); setSelected(null); setMessages([]); setCompose(false); setCurrentDraftId("") }
  const openCompose = () => { setCompose(true); setCurrentDraftId(""); draftThreadIdRef.current = null; setSelectedId(""); setSelected(null); setMessages([]); setTo(""); setCc(""); setSubject(""); setBody(""); setFiles([]); setShowCc(false); setMobileView("thread") }
  const openDraft = async (thread: Thread) => {
    const draft = thread.draft || { to: "", cc: "", subject: "", body: "" }
    setCurrentDraftId(thread.draftId || ""); draftThreadIdRef.current = thread.draftThreadId || null; setTo(draft.to || ""); setCc(draft.cc || ""); setSubject(draft.subject || ""); setBody(draft.body || ""); setShowCc(Boolean(draft.showCc || draft.cc)); setFiles([]); setCompose(true); setSelectedId(thread.draftThreadId || ""); setSelected(null); setMessages([]); setMobileView("thread")
  }
  const saveDraftAndClose = async () => {
    if (!selectedMailbox || (!to.trim() && !cc.trim() && !subject.trim() && !htmlToText(body).trim())) { setCompose(false); if (!selected) setMobileView("list"); return }
    setSavingDraft(true)
    try {
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draftIdRef.current || undefined, draft: { to, cc, subject, body, showCc }, threadId: selected?.id || draftThreadIdRef.current || null }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save draft.")
      setCurrentDraftId(data.draft.id); setCompose(false); setFolder("drafts"); setSelectedId(""); setSelected(null); setMessages([]); setNotice("Draft saved."); setMobileView("list"); if (folder === "drafts") await loadThreads()
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save draft.") }
    finally { setSavingDraft(false) }
  }
  const reply = (all = false) => {
    if (!selected) return
    draftThreadIdRef.current = selected.id
    const last = messages[messages.length - 1]
    const sender = last?.direction === "outbound" ? (last.to_emails || [])[0] : last?.from_email
    const otherRecipients = all && last ? [...(last.to_emails || []), ...(last.cc_emails || []), last.from_email] : []
    setTo(sender === selectedMailbox?.email ? (selected.participants.find((person) => person !== selectedMailbox.email) || "") : (sender || ""))
    setCc([...new Set(otherRecipients)].filter((person) => person !== selectedMailbox?.email && person !== sender).join(", "))
    setSubject(/^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`)
    setBody(""); setFiles([]); setShowCc(all); setCompose(true)
  }

  const updateThread = async (patch: Record<string, unknown>) => {
    if (!selected || !selectedMailbox) return
    const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/threads/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    const data = await response.json()
    if (!response.ok) { setNotice(data.error || "Could not update conversation."); return }
    setNotice("Conversation updated."); await Promise.all([loadThreads(), loadThread(selected.id)])
  }

  const sync = async () => {
    if (!selectedMailbox) return
    setSyncing(true); setNotice("")
    try {
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/sync`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        const restored = Number(data.crmImported || 0)
        const prefix = restored ? `Restored ${restored} CRM email${restored === 1 ? "" : "s"}. ` : ""
        throw new Error(`${prefix}${data.error || "Mailbox sync failed."}`)
      }
      const crmCount = Number(data.crmImported || 0)
      const crmNotice = crmCount ? ` Also restored ${crmCount} CRM email${crmCount === 1 ? "" : "s"}.` : ""
      const crmErrorNotice = data.crmError ? ` CRM history could not be fully imported: ${data.crmError}` : ""
      setNotice(`${data.imported} new ${data.imported === 1 ? "message" : "messages"} synced.${crmNotice}${crmErrorNotice}`); await loadThreads(); if (selectedId) await loadThread(selectedId)
    } catch (error) { setNotice(error instanceof Error ? error.message : "Mailbox sync failed.") }
    finally { setSyncing(false); await loadMailboxes() }
  }

  const send = async () => {
    if (!selectedMailbox || !to.trim() || !subject.trim() || !htmlToText(body).trim()) return
    if (draftTimerRef.current) { window.clearTimeout(draftTimerRef.current); draftTimerRef.current = null }
    setSending(true); setNotice("")
    try {
      const attachments = await Promise.all(files.map(async (file) => ({ filename: file.name, contentType: file.type || "application/octet-stream", content: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file) }) })))
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: selected?.id || draftThreadIdRef.current, to: to.split(/[;,]/).map((item) => item.trim()).filter(Boolean), cc: cc.split(/[;,]/).map((item) => item.trim()).filter(Boolean), subject, bodyHtml: body, attachments, requestId: crypto.randomUUID() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Message could not be sent.")
      if (draftIdRef.current) await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/drafts/${draftIdRef.current}`, { method: "DELETE" })
      setCurrentDraftId(""); draftThreadIdRef.current = null; setCompose(false); setFiles([]); setSelectedId(data.threadId); setNotice(data.historyWarning || "Message sent."); await loadThreads()
    } catch (error) { setNotice(error instanceof Error ? error.message : "Message could not be sent.") }
    finally { setSending(false) }
  }

  const createLabel = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedMailbox || !labelName.trim()) return
    try {
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: labelName.trim(), color: labelColor }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not create label.")
      setLabels((current) => [...current.filter((item) => item.id !== data.label.id), data.label])
      setLabelName(""); setLabelColor("#0f766e"); setAddingLabel(false); setNotice("Shared mailbox label created.")
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create label.") }
  }

  const deleteDraft = async () => {
    if (!selectedMailbox || !draftIdRef.current) return
    const deletingId = draftIdRef.current
    try {
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/drafts/${deletingId}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not delete draft.")
      setCurrentDraftId(""); setCompose(false); setFolder("drafts"); setThreads((current) => current.filter((item) => item.draftId !== deletingId)); setNotice("Draft deleted."); setMobileView("list")
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete draft.") }
  }

  const toggleThreadLabel = async (labelId: string) => {
    if (!selected || !selectedMailbox) return
    const current = selected.labels || []
    const ids = current.some((label) => label.id === labelId) ? current.filter((label) => label.id !== labelId).map((label) => label.id) : [...current.map((label) => label.id), labelId]
    const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/threads/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelIds: ids }) })
    const data = await response.json()
    if (!response.ok) { setNotice(data.error || "Could not update labels."); return }
    setSelected((thread) => thread ? { ...thread, labels: data.labels || [] } : thread)
    setThreads((items) => items.map((thread) => thread.id === selected.id ? { ...thread, labels: data.labels || [] } : thread))
  }

  const manageMailbox = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice("")
    try {
      const payload = { ...config, ...(editingMailboxId && staff.length === 0 ? { members: undefined } : {}), imapPort: Number(config.imapPort) || 993 }
      const response = await fetch(editingMailboxId ? "/api/admin/mailboxes" : "/api/admin/mailboxes", { method: editingMailboxId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingMailboxId ? { ...payload, id: editingMailboxId } : payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Mailbox could not be created.")
      setSettingsOpen(false); setEditingMailboxId(""); setConfig({ name: "", email: "", imapHost: "", imapPort: "993", imapUser: "", imapPassword: "", imapFolder: "INBOX", imapSecure: true, signatureFormat: "html", signatureHtml: "", members: [] }); await loadMailboxes(); if (data.mailbox?.id) setMailboxId(data.mailbox.id); setNotice(editingMailboxId ? "Mailbox settings saved." : "Shared mailbox added.")
    } catch (error) { setNotice(error instanceof Error ? error.message : "Mailbox could not be created.") }
  }

  const syncMailboxFromSettings = async () => {
    if (!editingMailboxId) return
    setSettingsSyncing(true)
    setSettingsSyncMessage("")
    try {
      const response = await fetch(`/api/admin/mailboxes/${editingMailboxId}/sync`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        const restored = Number(data.crmImported || 0)
        const prefix = restored ? `Restored ${restored} CRM email${restored === 1 ? "" : "s"}. ` : ""
        throw new Error(`${prefix}${data.error || "Mailbox sync failed."}`)
      }
      const crmCount = Number(data.crmImported || 0)
      const crmNotice = crmCount ? ` Also restored ${crmCount} CRM email${crmCount === 1 ? "" : "s"}.` : ""
      const crmErrorNotice = data.crmError ? ` CRM history could not be fully imported: ${data.crmError}` : ""
      setSettingsSyncMessage(`${data.imported} new ${data.imported === 1 ? "message" : "messages"} synced.${crmNotice}${crmErrorNotice}`)
      await loadThreads()
      await loadMailboxes()
    } catch (error) {
      setSettingsSyncMessage(`Could not sync: ${error instanceof Error ? error.message : "Mailbox sync failed."}`)
      await loadMailboxes()
    } finally {
      setSettingsSyncing(false)
    }
  }

  const editMailbox = async () => {
    if (!mailboxId) return
    try {
      const response = await fetch(`/api/admin/mailboxes?mailboxId=${mailboxId}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok || !data.settings) throw new Error(data.error || "Could not load mailbox settings.")
      const current = data.settings
      setSettingsSyncMessage("")
      setSignaturePreview(false)
      setEditingMailboxId(mailboxId)
      setConfig({ name: current.name || "", email: current.email || "", imapHost: current.imap_host || "", imapPort: String(current.imap_port || 993), imapUser: current.imap_user || "", imapPassword: "", imapFolder: current.imap_folder || "INBOX", imapSecure: current.imap_secure !== false, signatureFormat: current.signature_format === "plain" ? "plain" : "html", signatureHtml: current.signature_html || "", members: data.memberIds || [] })
      setSettingsOpen(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load mailbox settings.") }
  }

  const currentFolder = folders.find((item) => item.id === folder)?.label || "Inbox"
  const contact = useMemo(() => selected?.participants.find((person) => person !== selectedMailbox?.email) || selectedMailbox?.email || "", [selected, selectedMailbox])

  return <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f1f4f8] p-3 md:-m-6 md:p-6">
    <div className="mx-auto flex h-[calc(100vh-7rem)] min-h-[620px] max-w-[1600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <aside className={`${mobileView === "folders" ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[260px]`}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Mail className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400">MartPoint</p><h1 className="truncate text-lg font-semibold text-slate-900">Mailbox</h1></div></div>
        <div className="p-4"><button onClick={openCompose} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"><Pencil className="h-4 w-4" />New message</button></div>
        {mailboxes.length > 1 && <div className="relative px-4 pb-3"><label className="mb-1 block text-xs font-medium text-slate-500">Shared inbox</label><button type="button" onClick={() => setMailboxPickerOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-800">{selectedMailbox?.name || "Choose inbox"}<ChevronDown className="h-4 w-4 text-slate-400" /></button>{mailboxPickerOpen && <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">{mailboxes.map((mailbox) => <button type="button" key={mailbox.id} onClick={() => { setMailboxId(mailbox.id); setLabelFilter(""); setSelectedId(""); setSelected(null); setMessages([]); setCompose(false); setCurrentDraftId(""); setFolder("inbox"); setMailboxPickerOpen(false) }} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${mailbox.id === mailboxId ? "bg-emerald-50 font-medium text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}>{mailbox.name}</button>)}</div>}</div>}
        <div className="px-3 pb-4"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Folders</p>{folders.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => chooseFolder(id)} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${folder === id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{label}{id === "inbox" && <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] text-white">{threads.filter((thread) => thread.unread).length || ""}</span>}</button>)}</div>
        {selectedMailbox && <div className="border-t border-slate-100 px-3 py-4"><div className="flex items-center justify-between px-3 pb-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Shared labels</p><button type="button" title="Create shared label" onClick={() => setAddingLabel((open) => !open)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><Plus className="h-4 w-4" /></button></div>{addingLabel && <form onSubmit={createLabel} className="mb-2 flex flex-wrap items-center gap-1 px-2"><input autoFocus value={labelName} onChange={(event) => setLabelName(event.target.value)} maxLength={40} placeholder="Label name" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"/><label title="Choose label color" className="relative h-7 w-8 cursor-pointer overflow-hidden rounded border border-slate-200"><span className="absolute inset-0" style={{ backgroundColor: labelColor }}/><input aria-label="Label color" type="color" value={labelColor} onChange={(event) => setLabelColor(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/></label><button type="submit" title="Save label" className="rounded-md bg-emerald-600 px-2 py-1.5 text-white"><Check className="h-3.5 w-3.5"/></button></form>}<button onClick={() => setLabelFilter("")} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${!labelFilter ? "bg-slate-100 font-semibold text-slate-700" : "text-slate-500 hover:bg-slate-50"}`}>All conversations</button>{labels.map((label) => <button key={label.id} onClick={() => setLabelFilter((current) => current === label.id ? "" : label.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${labelFilter === label.id ? "bg-slate-100 font-semibold text-slate-800" : "text-slate-600 hover:bg-slate-50"}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }}/><span className="min-w-0 flex-1 truncate">{label.name}</span></button>)}</div>}
        <div className="mt-auto border-t border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{selectedMailbox?.name || "No mailbox yet"}</p><p className="truncate text-[11px] text-slate-400">{selectedMailbox?.email || "Configure a shared inbox"}</p>{selectedMailbox?.last_sync_error ? <p className="mt-2 text-[11px] leading-4 text-red-600">IMAP sync failed: {selectedMailbox.last_sync_error}</p> : selectedMailbox?.last_sync_at ? <p className="mt-2 text-[11px] text-slate-400">Last checked {new Date(selectedMailbox.last_sync_at).toLocaleString()}</p> : selectedMailbox && <p className="mt-2 text-[11px] text-amber-700">Inbox has not synced yet. Use the sync button to check IMAP.</p>}</div>{selectedMailbox?.canManage && <button title="Configure this shared inbox" onClick={editMailbox} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Settings2 className="h-4 w-4" /></button>}</div></div>
      </aside>

      <section className={`${mobileView === "list" ? "flex" : "hidden"} w-full min-w-0 flex-col border-r border-slate-200 bg-[#f7f9fb] md:flex md:w-[360px] md:shrink-0`}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4"><button className="rounded-lg p-2 text-slate-500 hover:bg-white md:hidden" onClick={() => setMobileView("folders")}><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">{currentFolder}</h2><button onClick={sync} disabled={syncing || !selectedMailbox} className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-50" title="Sync inbox"><ArchiveRestore className={`h-4 w-4 ${syncing ? "animate-pulse" : ""}`} /></button></div><p className="truncate text-xs text-slate-500">{selectedMailbox?.email || "Choose a shared inbox"}</p></div></div>
        <div className="border-b border-slate-200 p-3"><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />{query && <button onClick={() => setQuery("")} className="text-slate-400"><X className="h-4 w-4" /></button>}</div></div>
        <div className="flex-1 overflow-y-auto">{loading ? <div className="p-8 text-center text-sm text-slate-400">Loading conversations…</div> : visibleThreads.length === 0 ? <div className="px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-300"><Inbox className="h-5 w-5" /></div><p className="text-sm font-medium text-slate-600">{threads.length && labelFilter ? "No conversations with this label" : "Nothing here yet"}</p><p className="mt-1 text-xs text-slate-400">{threads.length && labelFilter ? "Choose another shared label or clear the filter." : folder === "drafts" ? "Drafts you save will appear here." : "New messages will appear in this folder."}</p></div> : visibleThreads.map((thread) => <button key={thread.id} onClick={() => thread.draftId ? openDraft(thread) : (setSelectedId(thread.id), setCompose(false), setMobileView("thread"))} className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-white ${selectedId === thread.id ? "bg-white shadow-[inset_3px_0_0_#059669]" : ""}`}><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{thread.draftId ? <Pencil className="h-4 w-4"/> : initials(displayName(thread.participants.find((person) => person !== selectedMailbox?.email) || thread.subject))}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-sm ${thread.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{thread.draftId ? thread.subject : displayName(thread.participants.find((person) => person !== selectedMailbox?.email) || thread.subject)}</p><span className="shrink-0 text-[11px] text-slate-400">{formatTime(thread.last_message_at)}</span></div><div className="mt-1 flex items-center gap-1.5"><p className={`truncate text-xs ${thread.unread ? "font-medium text-slate-700" : "text-slate-500"}`}>{thread.draftId ? (thread.draft?.to ? `To: ${thread.draft.to}` : "Draft") : thread.subject}</p>{thread.is_starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}</div><p className="mt-1 line-clamp-1 text-xs text-slate-400">{thread.last_message_preview}</p>{thread.labels?.length ? <div className="mt-2 flex flex-wrap gap-1">{thread.labels.map((label) => <span key={label.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: label.color, backgroundColor: `${label.color}18` }}>{label.name}</span>)}</div> : null}</div></div></button>)}</div>
      </section>

      <main className={`${mobileView === "thread" ? "flex" : "hidden"} min-w-0 flex-1 flex-col bg-white md:flex`}>
        {notice && <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-800"><span>{notice}</span><button onClick={() => setNotice("")}><X className="h-3.5 w-3.5" /></button></div>}
        {compose ? <>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 md:px-7"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setMobileView("list")}><ArrowLeft className="h-4 w-4" /></button><div><h2 className="text-lg font-semibold text-slate-900">{selected ? "Reply" : "New message"}</h2><p className="text-xs text-slate-500">From your profile email (on a Resend-verified domain) · replies go to {selectedMailbox?.email || "this shared inbox"} · shared signature added automatically</p></div><span className="ml-auto text-xs text-slate-400">{savingDraft ? "Saving draft…" : draftId ? "Draft saved" : "Autosaves as you type"}</span></div>
          <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-7"><div className="mx-auto flex w-full max-w-3xl flex-none flex-col rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"><span className="w-12 text-sm text-slate-500">To</span><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="name@example.com, another@example.com" className="min-w-0 flex-1 text-sm outline-none" /><button className="text-xs text-slate-500 hover:text-slate-900" onClick={() => setShowCc(!showCc)}>{showCc ? "Hide Cc" : "Cc"}</button></div>
            {showCc && <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"><span className="w-12 text-sm text-slate-500">Cc</span><input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="Add Cc recipients" className="min-w-0 flex-1 text-sm outline-none" /></div>}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"><span className="w-12 text-sm text-slate-500">Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} className="min-w-0 flex-1 text-sm outline-none" /></div>
            <div className="min-h-[180px]"><EmailRichEditor value={body} onChange={setBody} minHeight={220} allowImages={false} /></div>
            {files.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600"><Paperclip className="h-3.5 w-3.5" />{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button></span>)}</div>}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><Paperclip className="h-4 w-4" />Attach<input type="file" multiple className="hidden" onChange={(event) => { const next = Array.from(event.target.files || []); setFiles((current) => [...current, ...next].slice(0, 10)); event.currentTarget.value = "" }} /></label><span className="hidden truncate text-xs text-slate-400 sm:inline">Signature added automatically · attachments stay on this device until sent</span></div><div className="flex items-center gap-1">{draftId && <button onClick={deleteDraft} className="rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50">Delete draft</button>}<button onClick={saveDraftAndClose} disabled={savingDraft} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Save draft</button><button onClick={saveDraftAndClose} disabled={savingDraft} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Close</button><button disabled={sending || !to.trim() || !subject.trim() || !htmlToText(body).trim()} onClick={send} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{sending ? "Sending…" : "Send"}<Send className="h-4 w-4" /></button></div></div>
          </div></div>
        </> : selected ? <>
          <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 md:px-6"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setMobileView("list")}><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-slate-900">{selected.subject}</h2><p className="truncate text-xs text-slate-500">{contact}</p>{selected.labels?.length ? <div className="mt-1 flex flex-wrap gap-1">{selected.labels.map((label) => <span key={label.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: label.color, backgroundColor: `${label.color}18` }}>{label.name}</span>)}</div> : null}{selected.lead_id && <a href={`/admin/leads?lead=${encodeURIComponent(selected.lead_id)}`} className="mt-1 inline-block text-xs font-medium text-emerald-700 hover:underline">View lead Email history</a>}</div><details className="relative"><summary title="Manage shared labels" className="list-none cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></summary><div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Shared labels</p>{labels.length ? labels.map((label) => <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={Boolean(selected.labels?.some((item) => item.id === label.id))} onChange={() => toggleThreadLabel(label.id)} className="accent-emerald-600"/><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }}/>{label.name}</label>) : <p className="px-2 py-2 text-xs text-slate-400">Create a shared label from the sidebar.</p>}</div></details><button title={selected.is_starred ? "Remove star" : "Star"} onClick={() => updateThread({ starred: !selected.is_starred })} className={`rounded-lg p-2 hover:bg-slate-100 ${selected.is_starred ? "text-amber-500" : "text-slate-400"}`}><Star className={`h-4 w-4 ${selected.is_starred ? "fill-current" : ""}`} /></button><button title={selected.status === "closed" ? "Move to inbox" : "Archive"} onClick={() => updateThread({ status: selected.status === "closed" ? "open" : "closed" })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Archive className="h-4 w-4" /></button><button title={folder === "deleted" ? "Restore to inbox" : "Delete"} onClick={() => updateThread({ status: folder === "deleted" ? "open" : "deleted" })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">{folder === "deleted" ? <ArchiveRestore className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}</button>
          <div className="group relative"><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button><div className="absolute right-0 top-full z-10 hidden w-56 rounded-lg border bg-white p-2 shadow-lg group-focus-within:block group-hover:block"><label className="block px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assign to teammate</label><div className="relative"><button type="button" onClick={() => setAssigneePickerOpen((open) => !open)} className="mb-1 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-700">{staff.find((user) => user.id === selected.assigned_to)?.name || staff.find((user) => user.id === selected.assigned_to)?.username || "Unassigned"}<ChevronDown className="h-3.5 w-3.5 text-slate-400"/></button>{assigneePickerOpen && <div className="mb-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-1"><button type="button" onClick={() => { setAssigneePickerOpen(false); updateThread({ assignTo: null }) }} className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">Unassigned</button>{staff.map((user) => <button type="button" key={user.id} onClick={() => { setAssigneePickerOpen(false); updateThread({ assignTo: user.id }) }} className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${selected.assigned_to === user.id ? "bg-emerald-50 font-medium text-emerald-800" : "text-slate-700"}`}>{user.name || user.username} <span className="text-slate-400">· {user.role}</span></button>)}</div>}</div><button onClick={() => updateThread({ assignToMe: true })} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-slate-50">Assign to me</button><button onClick={() => reply(true)} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-slate-50">Reply all</button></div></div>
          </header>
          <div className="flex-1 space-y-5 overflow-y-auto bg-white p-4 md:px-7 md:py-6">{messages.map((message) => <article key={message.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${message.direction === "outbound" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-700"}`}>{initials(message.from_name || message.from_email)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{message.from_name || message.from_email}{message.sent_by_name ? <span className="font-normal text-slate-500"> · {message.sent_by_name}</span> : ""}</p><p className="truncate text-xs text-slate-500">To {message.to_emails?.join(", ") || selectedMailbox?.email}{message.cc_emails?.length ? ` · Cc ${message.cc_emails.join(", ")}` : ""}</p></div></div><time className="text-xs text-slate-400">{new Date(message.created_at).toLocaleString()}</time></div><div className="mailbox-message-content px-4 py-5 text-sm leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: messageHtml(message) }} />{message.attachments?.length ? <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">{message.attachments.map((attachment) => <a key={attachment.id} href={`/api/admin/mailboxes/${mailboxId}/attachments/${message.id}/${attachment.id}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"><Paperclip className="h-3.5 w-3.5" />{attachment.filename}<span className="text-slate-400">({Math.max(1, Math.ceil(attachment.size / 1024))} KB)</span></a>)}</div> : message.attachment_names?.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">{message.attachment_names.map((name, index) => <span key={`${name}-${index}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"><Paperclip className="h-3.5 w-3.5" />{name}</span>)}</div>}</article>)}</div>
          <div className="border-t border-slate-100 bg-white p-4 md:px-7"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="text-sm font-medium text-slate-700">Reply as your account</p><p className="truncate text-xs text-slate-400">To {contact} · shared mailbox signature applied automatically</p></div><div className="flex shrink-0 gap-2"><button onClick={() => reply(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Reply all</button><button onClick={() => reply(false)} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Reply <ChevronDown className="h-4 w-4" /></button></div></div></div>
        </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><MailOpen className="h-6 w-6" /></div><h2 className="font-semibold text-slate-800">{selectedMailbox ? "Your mailbox, in one place" : "Set up a shared inbox"}</h2><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{selectedMailbox ? "Choose a conversation to read and reply as yourself. Shared inbox access is managed per mailbox." : "Connect an IMAP inbox and choose which teammates can read and reply."}</p>{isAdmin && !mailboxes.length ? <button onClick={() => { setEditingMailboxId(""); setConfig({ name: "", email: "", imapHost: "", imapPort: "993", imapUser: "", imapPassword: "", imapFolder: "INBOX", imapSecure: true, signatureFormat: "html", signatureHtml: "", members: [] }); setSettingsOpen(true) }} className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />Add first mailbox</button> : selectedMailbox && <button onClick={openCompose} className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />Compose message</button>}</div>}
      </main>
    </div>

    {settingsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{editingMailboxId ? "Manage shared mailbox" : "Add a shared mailbox"}</h2><p className="mt-1 text-sm text-slate-500">Messages sync from IMAP. Teammates send from the email saved on their MartPoint user account; replies go to this shared inbox, and its signature is appended automatically.</p></div><button onClick={() => { setSettingsOpen(false); setEditingMailboxId("") }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><form onSubmit={manageMailbox} className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{[["Mailbox name", "name", "Sales"], ["Inbox address", "email", "sales@martpoint.com.ng"], ["IMAP host", "imapHost", "imap.mailhost.com"], ["IMAP port", "imapPort", "993"], ["IMAP username", "imapUser", "sales@martpoint.com.ng"], [editingMailboxId ? "New IMAP app password (optional)" : "IMAP app password", "imapPassword", "••••••••••"]].map(([label, key, placeholder]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input required={!editingMailboxId || key !== "imapPassword"} value={config[key as keyof typeof config] as string} onChange={(event) => setConfig((current) => ({ ...current, [key]: event.target.value }))} type={key === "imapPassword" ? "password" : "text"} disabled={editingMailboxId !== "" && key === "email"} placeholder={placeholder} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" /></label>)}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-600">IMAP folder<input value={config.imapFolder} onChange={(event) => setConfig((current) => ({ ...current, imapFolder: event.target.value }))} placeholder="INBOX" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500" /></label><label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={config.imapSecure} onChange={(event) => setConfig((current) => ({ ...current, imapSecure: event.target.checked }))} className="accent-emerald-600" />Use secure IMAP connection</label></div><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-medium text-slate-600">Shared mailbox signature <span className="font-normal text-slate-400">· used for all new messages and replies</span></label><div className="inline-flex rounded-lg border border-slate-200 p-0.5"><button type="button" onClick={() => setConfig((current) => ({ ...current, signatureFormat: "plain" }))} className={`rounded-md px-3 py-1.5 text-xs ${config.signatureFormat === "plain" ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-500"}`}>Plain text</button><button type="button" onClick={() => setConfig((current) => ({ ...current, signatureFormat: "html" }))} className={`rounded-md px-3 py-1.5 text-xs ${config.signatureFormat === "html" ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-500"}`}>HTML</button></div></div><textarea value={config.signatureHtml} onChange={(event) => setConfig((current) => ({ ...current, signatureHtml: event.target.value }))} rows={config.signatureFormat === "html" ? 8 : 5} maxLength={1000000} placeholder={config.signatureFormat === "html" ? "Paste HTML source with inline styles, tables, and image URLs…" : "Type a plain text signature…"} className="w-full resize-y rounded-lg border border-slate-200 p-3 font-mono text-xs leading-5 outline-none focus:border-emerald-500" />{config.signatureFormat === "html" && <div className="mt-2"><button type="button" onClick={() => { const team = window.prompt("Team or department name (for example, Sales Team or Operations Team)", "Team"); if (team === null) return; setConfig((current) => ({ ...current, signatureFormat: "html", signatureHtml: martPointSignatureHtml(team, current.email, window.location.origin) })); setSignaturePreview(true) }} className="mr-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">Use MartPoint signature layout</button><button type="button" onClick={() => setSignaturePreview((value) => !value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">{signaturePreview ? "Hide preview" : "Preview HTML signature"}</button>{signaturePreview && <iframe sandbox="" title="HTML signature preview" srcDoc={`<!doctype html><html><body style="margin:0;padding:16px;background:white;font-family:Arial,sans-serif">${config.signatureHtml}</body></html>`} className="mt-2 h-72 w-full rounded-lg border border-slate-200 bg-white" />}</div>}{config.signatureFormat === "html" ? <p className="mt-1.5 text-xs text-slate-500">Use inline HTML styles and full image URLs. Remote HTTPS images display most reliably; the editor preview shows how the signature HTML will render.</p> : <p className="mt-1.5 text-xs text-slate-500">Plain text is safely escaped and rendered as a signature.</p>}</div><label className="block text-xs font-medium text-slate-600">Mailbox members <span className="font-normal text-slate-400">· select everyone who can read and reply</span></label><div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2">{staff.length ? staff.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"><input type="checkbox" checked={config.members.includes(user.id)} onChange={(event) => setConfig((current) => ({ ...current, members: event.target.checked ? [...current.members, user.id] : current.members.filter((id) => id !== user.id) }))} className="accent-emerald-600" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-700">{user.name || user.username}</span><span className="block truncate text-xs text-slate-400">{user.email}</span></span><span className="text-[10px] uppercase text-slate-400">{user.role}</span></label>) : <p className="p-3 text-sm text-slate-400">Mailbox members can be changed by an Admin.</p>}</div>{editingMailboxId && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">Check incoming mail</p><p className="text-xs text-slate-500">Connect to this mailbox’s IMAP server and import new messages.</p></div><button type="button" onClick={syncMailboxFromSettings} disabled={settingsSyncing} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{settingsSyncing ? "Syncing…" : "Sync now"}</button></div>{settingsSyncMessage && <p className={`mt-2 text-xs ${settingsSyncMessage.includes("failed") || settingsSyncMessage.includes("Could not") ? "text-red-600" : "text-emerald-700"}`}>{settingsSyncMessage}</p>}{mailboxes.find((item) => item.id === editingMailboxId)?.last_sync_error && <p className="mt-2 text-xs text-red-600">Last sync error: {mailboxes.find((item) => item.id === editingMailboxId)?.last_sync_error}</p>}{mailboxes.find((item) => item.id === editingMailboxId)?.last_sync_at && <p className="mt-1 text-xs text-slate-500">Last checked {new Date(mailboxes.find((item) => item.id === editingMailboxId)!.last_sync_at!).toLocaleString()}</p>}</div>}<div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => { setSettingsOpen(false); setEditingMailboxId("") }} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Check className="h-4 w-4" />{editingMailboxId ? "Save changes" : "Save mailbox"}</button></div></form></div></div>}
  </div>
}
