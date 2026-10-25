"use client"

import { Bot, FilePlus2, Mail, MessageCircle, Paperclip, Phone, Ticket, Users } from "lucide-react"

interface Details {
  id: string; customer_name: string | null; customer_phone: string | null; external_id: string;
  ai_enabled: boolean; ticket_id: string | null; status: string; last_message_at: string;
  waiting_for_agent: boolean; escalation_reason: string | null; queue: string;
  knowledge_refs: Array<{ id?: string; title?: string; source?: string }>
}
export function OmnichannelDetails({ conversation, email, callBusy, onCall, onTicket, onUpload, onInvite }: {
  conversation: Details | null; email: string | null; callBusy: boolean;
  onCall: () => void; onTicket: () => void; onUpload: () => void; onInvite: () => void;
}) {
  if (!conversation) return <aside className="flex min-w-0 items-center justify-center border-t border-slate-200 bg-white p-6 text-center text-sm text-slate-500 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">Select a conversation to see contact details and actions.</aside>
  const date = new Date(conversation.last_message_at)
  const activity = Number.isNaN(date.getTime()) ? null : date
  return <aside aria-label="Conversation details" className="min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain border-t border-slate-200 bg-slate-50/60 p-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 xl:col-span-1 xl:block xl:space-y-5 xl:border-l xl:border-t-0">
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
      <p className="mt-3 break-words text-sm font-medium text-slate-900">{conversation.customer_name || "Website visitor"}</p>
      {conversation.customer_phone && <p className="mt-1 break-all text-sm text-slate-600">{conversation.customer_phone}</p>}
      {email && <p className="mt-1 break-all text-sm text-slate-600">{email}</p>}
      {!email && !conversation.customer_phone && <p className="mt-1 text-xs leading-5 text-slate-500">No contact details shared yet.</p>}
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3"><dt className="flex items-center gap-2 text-slate-600"><Bot className="h-4 w-4 shrink-0" />AI assistant</dt><dd><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${conversation.ai_enabled ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${conversation.ai_enabled ? "bg-blue-500" : "bg-amber-500"}`} />{conversation.ai_enabled ? "Active" : "Paused"}</span></dd></div>
        <div className="flex flex-wrap items-start justify-between gap-2 py-3"><dt className="flex items-center gap-2 text-slate-600"><Ticket className="h-4 w-4 shrink-0" />Support ticket</dt><dd>{conversation.ticket_id ? <a href={`/admin/support?id=${encodeURIComponent(conversation.ticket_id)}`} className="font-semibold text-blue-600 hover:underline">Open ticket ↗</a> : <span className="text-slate-500">Not created</span>}</dd></div>
        <div className="space-y-1.5 pt-3"><dt className="text-slate-600">Last activity</dt><dd className="font-medium leading-5 text-slate-900">{activity ? <time dateTime={activity.toISOString()}>{activity.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}<span className="ml-2 whitespace-nowrap text-slate-600">{activity.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></time> : "No activity recorded"}</dd></div>
      </dl>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Contact actions</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <button onClick={onCall} disabled={callBusy || !conversation.customer_phone} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Phone className="h-4 w-4 shrink-0" />{callBusy ? "Call in progress" : "Call in browser"}</button>
        {!conversation.customer_phone && <p className="text-xs leading-5 text-slate-500">A phone number is needed to call this contact.</p>}
        {conversation.customer_phone && <a href={`https://wa.me/${conversation.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
        {email && <a href={`mailto:${email}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Mail className="h-4 w-4" />Email</a>}
        <button onClick={onTicket} disabled={Boolean(conversation.ticket_id)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><FilePlus2 className="h-4 w-4" />{conversation.ticket_id ? "Ticket linked" : "Create ticket"}</button>
        <button onClick={onUpload} disabled={conversation.status === "closed"} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Paperclip className="h-4 w-4" />Request file upload</button>
        <button onClick={onInvite} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Users className="h-4 w-4" />Invite technical agent</button>
      </div>
    </section>
    {(conversation.waiting_for_agent || conversation.escalation_reason) && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><h2 className="font-semibold">{conversation.waiting_for_agent ? "Waiting for a team member" : "Handoff recorded"}</h2><p>{conversation.queue.replaceAll("_", " ")}</p>{conversation.escalation_reason && <p className="break-words">{conversation.escalation_reason.replaceAll("_", " ")}</p>}</section>}
    {conversation.knowledge_refs?.some((item) => item.title) && <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-900">Knowledge used by Azera</h2><ul className="mt-3 space-y-2">{conversation.knowledge_refs.map((item, index) => item.title ? <li key={item.id || index} className="break-words text-sm leading-5 text-slate-600">{item.title}</li> : null)}</ul></section>}
  </aside>
}
