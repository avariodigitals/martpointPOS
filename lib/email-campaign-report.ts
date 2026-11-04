/** Client-safe report calculations. A provider accepting mail is not proof of inbox delivery. */
export interface CampaignSend {
  id: string
  email: string
  name: string
  status: string
  error_message: string | null
  sent_at: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
}
export interface CampaignMetrics {
  sent: number
  failed: number
  opens: number
  openTotal: number
  clicks: number
  clickTotal: number
}
export interface EmailCampaign {
  id: string
  name: string
  subject: string
  preheader: string
  audience: string
  audienceId?: string
  audienceName?: string
  fromAddress?: string | null
  replyTo?: string | null
  html?: string
  provider: string
  status: string
  recipientCount: number
  createdAt: string
  sentAt: string | null
  scheduledFor: string | null
  metrics: CampaignMetrics
}
export const audienceLabels: Record<string, string> = {
  leads: "Leads", partner_leads: "Partner leads", businesses: "Businesses",
  newsletter: "Newsletter subscribers", saved: "Saved audience", manual: "Pasted recipients",
}
export function campaignMetrics(sends: CampaignSend[]): CampaignMetrics {
  return sends.reduce((m, s) => ({
    sent: m.sent + Number(s.status === "sent"), failed: m.failed + Number(s.status === "failed"),
    opens: m.opens + Number(Boolean(s.opened_at)), openTotal: m.openTotal + (s.open_count || 0),
    clicks: m.clicks + Number(Boolean(s.clicked_at)), clickTotal: m.clickTotal + (s.click_count || 0),
  }), { sent: 0, failed: 0, opens: 0, openTotal: 0, clicks: 0, clickTotal: 0 })
}
export function rate(count: number, total: number): string {
  return `${total > 0 ? (count / total * 100).toFixed(1) : "0.0"}%`
}
export function campaignDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) + " WAT" : "—"
}
/** Spreadsheet formula protection applies even to user-supplied names and subjects. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "")
  if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}
export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
