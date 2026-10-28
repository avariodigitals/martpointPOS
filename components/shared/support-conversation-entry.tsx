import { enumLabel } from "@/lib/utils"

export type PublicSupportMessage = {
  id: string
  author_type: string
  author_name?: string | null
  message: string
  message_html?: string | null
  signature_html?: string | null
  created_at: string
}
export function SupportConversationEntry({ message }: { message: PublicSupportMessage }) {
  return (
    <details className="group rounded-lg border border-border bg-background">
      <summary className="flex cursor-pointer list-none items-start gap-2 p-3 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {message.author_name || enumLabel(message.author_type)}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{message.message}</span>
        </span>
        <time className="text-[10px] text-muted-foreground">
          {new Date(message.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </summary>
      <div className="border-t border-border p-4 text-sm leading-relaxed [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full">
        {message.message_html ? (
          <div dangerouslySetInnerHTML={{ __html: message.message_html }} />
        ) : (
          <p className="whitespace-pre-wrap">{message.message}</p>
        )}
        {message.signature_html && message.author_type !== "SYSTEM" && (
          <div className="mt-4 border-t border-border pt-3" dangerouslySetInnerHTML={{ __html: message.signature_html }} />
        )}
      </div>
    </details>
  )
}
