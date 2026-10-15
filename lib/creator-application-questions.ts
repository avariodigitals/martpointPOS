/* ───────────────────────────  Creator application question rounds  ───────────────────────────
 * Mirrors lib/partner-application-questions.ts: admins send a timed set of
 * follow-up questions (text or file-upload fields) to a creator applicant via a
 * token link; answers land back on the admin application page. Sending flips the
 * application to MANUAL_REVIEW ("under review"). Drafts can be generated from the
 * latest AI review's suggested questions before an interview.
 */

import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { questionnaireFieldSchema, type QuestionnaireField } from "./lead-questionnaire"
import { escapeHtml } from "./email-html"
import { changeCreatorApplicationStatus } from "./creator-applications"
import { uploadCreatorFile, createCreatorFileSignedUrl } from "./creator-storage"

export type CreatorQuestionStatus = "Sent" | "Submitted" | "Reviewed"

export type CreatorQuestionAttachment = {
  path: string
  name: string
  size: number
  mime: string
}

export type CreatorApplicationQuestionRound = {
  id: string
  application_id: string
  token: string
  title: string
  fields: QuestionnaireField[]
  responses: Record<string, unknown>
  status: CreatorQuestionStatus
  sent_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
}

const TERMINAL_STATUSES = ["APPROVED", "REJECTED", "SUSPENDED"]

export async function listApplicationQuestionRounds(applicationId: string): Promise<CreatorApplicationQuestionRound[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.from("creator_application_question_rounds").select("*")
    .eq("application_id", applicationId).order("created_at", { ascending: false })
  return error ? [] : (data || []) as CreatorApplicationQuestionRound[]
}

/** Replace file-field answer arrays with signed URLs for admin viewing (URLs are short-lived). */
export async function withSignedAttachmentUrls(round: CreatorApplicationQuestionRound) {
  const responses = { ...(round.responses || {}) } as Record<string, unknown>
  for (const field of round.fields || []) {
    if (field.type !== "file") continue
    const items = responses[field.name]
    if (!Array.isArray(items)) continue
    responses[field.name] = await Promise.all(items.map(async (item) => {
      const att = item as CreatorQuestionAttachment
      const url = att?.path ? await createCreatorFileSignedUrl(att.path, 300) : null
      return { name: att?.name, size: att?.size, mime: att?.mime, url }
    }))
  }
  return { ...round, responses }
}

export async function getRoundByToken(token: string) {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("creator_application_question_rounds")
    .select("id, application_id, title, fields, responses, status").eq("token", token).maybeSingle()
  return data as Pick<CreatorApplicationQuestionRound, "id" | "application_id" | "title" | "fields" | "responses" | "status"> | null
}

/** Upload one answer file for a question round into private storage. */
export async function uploadRoundAttachment(input: {
  roundId: string; filename: string; mimeType: string; bytes: Buffer | ArrayBuffer
}): Promise<{ ok: true; attachment: CreatorQuestionAttachment } | { ok: false; error: string }> {
  const uploaded = await uploadCreatorFile(`question-round-${input.roundId}`, input.filename, input.mimeType, input.bytes)
  if (!uploaded.ok || !uploaded.storagePath) return { ok: false, error: uploaded.error || "Upload failed" }
  return {
    ok: true,
    attachment: { path: uploaded.storagePath, name: input.filename, size: input.bytes.byteLength, mime: input.mimeType },
  }
}

export async function sendApplicationQuestionRound(input: {
  applicationId: string; title: string; fields: QuestionnaireField[]; actorId: string; actorName: string; origin: string
}) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Service unavailable" }
  const fields = input.fields.filter((field) => field.name.trim() && field.label.trim())
  if (!fields.length) return { ok: false as const, error: "Add at least one question" }
  const checked = fields.map((field) => questionnaireFieldSchema.safeParse(field))
  if (checked.some((item) => !item.success)) return { ok: false as const, error: "One or more question fields are invalid" }

  const { data: app, error: appError } = await supabase.from("creator_applications")
    .select("id, reference_number, full_name, email, status").eq("id", input.applicationId).single()
  if (appError || !app) return { ok: false as const, error: "Application not found" }
  if (TERMINAL_STATUSES.includes(app.status as string)) return { ok: false as const, error: "This application already has a final decision" }
  if (!app.email) return { ok: false as const, error: "Applicant has no email address" }

  const token = crypto.randomUUID()
  const now = new Date().toISOString()
  const { data: round, error } = await supabase.from("creator_application_question_rounds").insert({
    application_id: input.applicationId, token, title: input.title.trim() || "Additional Questions", fields,
    status: "Sent", sent_at: now, created_by: input.actorId,
  }).select().single()
  if (error || !round) return { ok: false as const, error: "Could not save question round" }

  const url = `${input.origin.replace(/\/$/, "")}/creator/questions/${token}`
  const safeTitle = input.title.trim() || "Additional Questions"
  const questionCount = fields.length
  const sent = await sendEmail({
    to: app.email as string,
    subject: `MartPoint Creator Network: ${safeTitle}`,
    text: `Hello ${app.full_name || "there"},\n\nThanks for your interest in the MartPoint Creator Network (application ${app.reference_number}). Our team has a few additional questions before the interview stage. Please answer them here:\n${url}\n\nSome questions let you attach screenshots or documents from your insights dashboard.\n\nMartPoint Creator Network Team`,
    html: `<p>Hello ${escapeHtml(String(app.full_name || "there"))},</p><p>Thanks for your interest in the MartPoint Creator Network (application <strong>${escapeHtml(String(app.reference_number))}</strong>). Our team has a few additional questions before the interview stage.</p><p><a href="${url}">Answer the additional questions</a></p><p>Some questions let you attach screenshots or documents from your insights dashboard.</p><p>MartPoint Creator Network Team</p>`,
    replyTo: REPLY_TO.digitals,
  })

  await changeCreatorApplicationStatus(
    input.applicationId, "MANUAL_REVIEW",
    { id: input.actorId, name: input.actorName },
    `${safeTitle} · ${questionCount} question(s) sent to ${app.email}${sent ? "" : " (email delivery failed)"}`,
  )
  return { ok: true as const, round: round as CreatorApplicationQuestionRound, emailSent: sent, url }
}

export async function submitApplicationQuestionResponses(
  token: string,
  responses: Record<string, unknown>,
  expectedFileNames: string[] = [],
) {
  const round = await getRoundByToken(token)
  if (!round) return { ok: false as const, error: "Invalid or expired question link" }
  if (round.status !== "Sent") return { ok: false as const, error: "These questions have already been submitted" }
  const fields = (round.fields || []) as QuestionnaireField[]
  for (const field of fields) {
    if (!field.required) continue
    const answer = responses[field.name]
    const empty = answer === undefined || answer === null || answer === ""
      || (Array.isArray(answer) && answer.length === 0)
    if (empty) return { ok: false as const, error: `Please answer: ${field.label}` }
    if (field.type === "file" && !expectedFileNames.includes(field.name) && !Array.isArray(answer)) {
      return { ok: false as const, error: `Please attach a file for: ${field.label}` }
    }
  }
  const now = new Date().toISOString()
  const { error } = await supabase.from("creator_application_question_rounds")
    .update({ responses, status: "Submitted", submitted_at: now, updated_at: now }).eq("id", round.id)
  if (error) return { ok: false as const, error: "Could not save your answers" }

  // Timeline note without changing status (MANUAL_REVIEW = still under review).
  const { data: app } = await supabase.from("creator_applications")
    .select("status, status_history").eq("id", round.application_id).maybeSingle()
  if (app) {
    const history = [
      ...((app.status_history as unknown[]) || []),
      { status: app.status, at: now, by: "Applicant", reason: "Applicant submitted answers to additional questions." },
    ]
    await supabase.from("creator_applications").update({ status_history: history, updated_at: now }).eq("id", round.application_id)
  }
  return { ok: true as const }
}

/* ───────────────────────────  Sample question templates  ─────────────────────────── */

export const CREATOR_SAMPLE_QUESTION_PACKS: { key: string; title: string; description: string; fields: QuestionnaireField[] }[] = [
  {
    key: "verification",
    title: "Application Verification Pack",
    description: "Prove the numbers in the application with dashboard screenshots, category fit and a sample content willingness check.",
    fields: [
      { name: "vp_featured_posts", label: "Share 2–3 posts or videos where you featured a business and its products. Include the links and how each one performed.", type: "textarea", required: true },
      { name: "vp_metrics_explanation", label: "Your application reports specific view, engagement and follower numbers. Where can we verify each of these?", type: "textarea", required: true, helpText: "Mention the dashboard or report for each number." },
      { name: "vp_metrics_screenshots", label: "Attach screenshots of your insights showing those numbers", type: "file", required: true, helpText: "PDF, PNG, JPEG or WEBP · up to 5 MB each" },
      { name: "vp_category_fit", label: "Why did you choose your primary and secondary content categories? Give examples of content in each.", type: "textarea", required: true },
      { name: "vp_audience_demographics", label: "What does your insights dashboard show about your audience — age ranges, gender split and locations?", type: "textarea", required: true },
      { name: "vp_audience_screenshot", label: "Attach your audience demographics screenshot (optional)", type: "file", helpText: "PDF, PNG, JPEG or WEBP · up to 5 MB each" },
      { name: "vp_business_content_examples", label: "Give examples of business or product content you have created for the audience you described.", type: "textarea" },
      { name: "vp_sample_video", label: "Are you open to creating a short sample video about MartPoint before the interview?", type: "boolean", required: true },
    ],
  },
  {
    key: "light",
    title: "Quick Clarifier",
    description: "Three lightweight questions to clear up gaps before the interview, with one optional upload.",
    fields: [
      { name: "qc_best_content", label: "Which piece of your content are you most proud of, and why? Share the link.", type: "textarea", required: true },
      { name: "qc_audience_ask", label: "What do your followers ask you most about?", type: "textarea", required: true },
      { name: "qc_availability", label: "How many hours per week could you dedicate to MartPoint content?", type: "text", required: true },
      { name: "qc_supporting_file", label: "Anything else that helps your application? Attach it here (optional)", type: "file" },
    ],
  },
]

/* ───────────────────────────  Draft generation from AI review  ─────────────────────────── */

const VERIFY_HINT = /(screenshot|insight|proof|evidence|verif|dashboard|analytics|report|engagement|views|followers|reach|metrics|claim)/i

/** Build an unsent draft round from the applicant's latest completed AI review:
 *  each suggested interview question becomes a textarea, verification-flavoured
 *  questions get a paired upload field, and a FURTHER_VERIFICATION recommendation
 *  adds a required evidence upload up front. */
export async function generateDraftFromAiReview(applicationId: string): Promise<
  { ok: true; title: string; fields: QuestionnaireField[] } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }
  const { data: review } = await supabase.from("creator_ai_reviews")
    .select("suggested_questions, concerns, recommendation, data_notes").eq("application_id", applicationId)
    .eq("status", "COMPLETED").order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (!review) return { ok: false, error: "Run the AI review on this application first" }

  const fields: QuestionnaireField[] = []
  if (review.recommendation === "FURTHER_VERIFICATION") {
    fields.push(
      { name: "ai_evidence_note", label: "Which of your reported numbers can you verify right now, and from where?", type: "textarea", required: true },
      { name: "ai_evidence_files", label: "Attach screenshots of your insights or analytics dashboard", type: "file", required: true, helpText: "PDF, PNG, JPEG or WEBP · up to 5 MB each" },
    )
  }
  const questions = Array.isArray(review.suggested_questions) ? (review.suggested_questions as string[]).filter(Boolean).slice(0, 8) : []
  questions.forEach((question, i) => {
    const name = `ai_q${i + 1}`
    fields.push({ name, label: question.trim().slice(0, 500), type: "textarea", required: true })
    if (VERIFY_HINT.test(question)) {
      fields.push({
        name: `${name}_files`, label: `Attachment for: “${question.trim().slice(0, 80)}” (optional)`,
        type: "file", helpText: "PDF, PNG, JPEG or WEBP · up to 5 MB each",
      })
    }
  })
  const concerns = Array.isArray(review.concerns) ? (review.concerns as string[]).filter(Boolean).slice(0, 3) : []
  concerns.forEach((concern, i) => {
    fields.push({ name: `ai_c${i + 1}`, label: `Our team noted: ${concern.trim().slice(0, 300)} — please address this.`, type: "textarea" })
  })
  if (!fields.length) return { ok: false, error: "The AI review did not suggest any questions" }
  return { ok: true, title: "Pre-Interview Questions", fields }
}
