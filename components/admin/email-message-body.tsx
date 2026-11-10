import { plainEmailToHtml } from "@/lib/plain-email-format"

/** Display a sanitized email HTML part, or format the plain-text MIME fallback. */
export function EmailMessageBody({ html, text, className = "" }: { html?: string | null; text?: string | null; className?: string }) {
  const content = html?.trim() || plainEmailToHtml(text || "")
  return <div
    className={`email-message-body min-w-0 break-words text-sm leading-7 text-slate-800 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:bg-slate-50 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:py-2 [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h1]:my-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-slate-200 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 ${className}`}
    dangerouslySetInnerHTML={{ __html: content }}
  />
}
