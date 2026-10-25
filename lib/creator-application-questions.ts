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
import { notifyAllAdmins } from "./admin-notifications"

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
  email_subject: string | null
  email_intro: string | null
  fields: QuestionnaireField[]
  responses: Record<string, unknown>
  status: CreatorQuestionStatus
  sent_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  initial_email_status: "PENDING" | "SENT" | "FAILED"
  reminder_count: number
  last_reminder_at: string | null
  next_reminder_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
  view_count: number
  created_at: string
  email_attempts?: CreatorQuestionEmailAttempt[]
}

export type CreatorQuestionEmailAttempt = {
  id: string
  kind: "INITIAL" | "REMINDER"
  attempt_no: number
  status: "SENT" | "FAILED"
  error_message: string | null
  provider_accepted_at: string | null
  created_at: string
}

const TERMINAL_STATUSES = ["APPROVED", "REJECTED", "SUSPENDED"]
const MAX_REMINDERS = 10
const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000
const CLAIM_TIMEOUT_MS = 2 * 60 * 60 * 1000

function siteUrl(origin?: string): string {
  // Do not email a localhost or admin-origin link when the canonical public
  // site URL is configured. The answer page is public and must be reachable
  // from the applicant's email, regardless of where the admin is signed in.
  return (process.env.NEXT_PUBLIC_SITE_URL || origin || "https://martpoint.com.ng").replace(/\/$/, "")
}

async function recordQuestionEmail(input: {
  roundId: string
  applicationId: string
  kind: "INITIAL" | "REMINDER"
  attemptNo: number
  sent: boolean
  errorMessage?: string | null
}) {
  await supabase.from("creator_application_question_emails").insert({
    round_id: input.roundId,
    application_id: input.applicationId,
    kind: input.kind,
    attempt_no: input.attemptNo,
    status: input.sent ? "SENT" : "FAILED",
    error_message: input.errorMessage ?? (input.sent ? null : "Email provider rejected send"),
    provider_accepted_at: input.sent ? new Date().toISOString() : null,
  })
}

export async function listApplicationQuestionRounds(applicationId: string): Promise<CreatorApplicationQuestionRound[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.from("creator_application_question_rounds").select("*")
    .eq("application_id", applicationId).order("created_at", { ascending: false })
  if (error || !data?.length) return error ? [] : []

  const roundIds = data.map((round) => round.id as string)
  const { data: attempts } = await supabase.from("creator_application_question_emails")
    .select("id, round_id, kind, attempt_no, status, error_message, provider_accepted_at, created_at")
    .in("round_id", roundIds).order("created_at", { ascending: false })
  const attemptsByRound = new Map<string, CreatorQuestionEmailAttempt[]>()
  for (const attempt of attempts || []) {
    const roundAttempts = attemptsByRound.get(attempt.round_id as string) || []
    roundAttempts.push(attempt as CreatorQuestionEmailAttempt)
    attemptsByRound.set(attempt.round_id as string, roundAttempts)
  }
  return data.map((round) => ({
    ...(round as CreatorApplicationQuestionRound),
    email_attempts: attemptsByRound.get(round.id as string) || [],
  }))
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
  applicationId: string; title: string; fields: QuestionnaireField[]; actorId: string; actorName: string; origin: string; emailSubject?: string; emailIntro?: string
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
  const safeTitle = input.title.trim() || "Additional Questions"
  const safeEmailSubject = input.emailSubject?.trim().slice(0, 200) || `MartPoint Creator Network: ${safeTitle}`
  const safeEmailIntro = input.emailIntro?.trim().slice(0, 8000) || `Thanks for your interest in the MartPoint Creator Network (application ${app.reference_number || ""}). Our team has a few additional questions before the next stage.`
  const { data: round, error } = await supabase.from("creator_application_question_rounds").insert({
    application_id: input.applicationId, token, title: safeTitle, email_subject: safeEmailSubject, email_intro: safeEmailIntro, fields,
    status: "Sent", sent_at: now, created_by: input.actorId,
  }).select().single()
  if (error || !round) return { ok: false as const, error: "Could not save question round" }

  const url = `${siteUrl(input.origin)}/creator/questions/${token}`
  const questionCount = fields.length
  const sent = await sendEmail({
    to: app.email as string,
    subject: safeEmailSubject,
    text: `Hi ${app.full_name || "there"},\n\n${safeEmailIntro}\n\nPlease answer the questions here:\n${url}\n\nSome questions let you attach screenshots or documents.\n\nMartPoint Creator Network Team`,
    html: `<p>Hi ${escapeHtml(String(app.full_name || "there"))},</p>${safeEmailIntro.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join("")}<p><a href="${url}">Answer the questions</a></p><p>Some questions let you attach screenshots or documents.</p><p>MartPoint Creator Network Team</p>`,
    replyTo: REPLY_TO.digitals,
  })

  await recordQuestionEmail({
    roundId: round.id as string,
    applicationId: input.applicationId,
    kind: "INITIAL",
    attemptNo: 0,
    sent,
  })
  await supabase.from("creator_application_question_rounds").update({
    initial_email_status: sent ? "SENT" : "FAILED",
    next_reminder_at: new Date(Date.now() + REMINDER_INTERVAL_MS).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", round.id as string)

  await changeCreatorApplicationStatus(
    input.applicationId, "MANUAL_REVIEW",
    { id: input.actorId, name: input.actorName },
    `${safeTitle} · ${questionCount} question(s) sent to ${app.email}${sent ? "" : " (email delivery failed)"}`,
  )
  return { ok: true as const, round: round as CreatorApplicationQuestionRound, emailSent: sent, url }
}

type ReminderRound = {
  id: string
  application_id: string
  token: string
  title: string
  email_subject: string | null
  email_intro: string | null
  status: CreatorQuestionStatus
  reminder_count: number
  reminder_claimed_at: string | null
  application: { id: string; reference_number: string | null; full_name: string; email: string; status: string } | null
}

async function placeApplicationOnHold(applicationId: string, reference: string | null, name: string): Promise<boolean> {
  const { data: current } = await supabase.from("creator_applications")
    .select("status").eq("id", applicationId).maybeSingle()
  if (!current || TERMINAL_STATUSES.includes(current.status as string)) return false
  const held = await changeCreatorApplicationStatus(
    applicationId,
    "SUSPENDED",
    { id: null, name: "Reminder automation" },
    `Application placed on hold after ${MAX_REMINDERS} unanswered question reminders.`,
  )
  if (held) {
    await notifyAllAdmins({
      type: "CREATOR_APPLICATION_ON_HOLD",
      title: "Creator application placed on hold",
      message: `${reference || name} did not answer additional questions after ${MAX_REMINDERS} reminders.`,
      deep_link: `/admin/creators/applications/${applicationId}`,
      source_type: "creator_application",
      source_id: applicationId,
      roles: ["Admin", "Digital Marketer"],
    })
  }
  return held
}

async function loadReminderRound(roundId: string): Promise<ReminderRound | null> {
  const { data } = await supabase.from("creator_application_question_rounds")
    .select("id, application_id, token, title, email_subject, email_intro, status, reminder_count, reminder_claimed_at, application:application_id(id, reference_number, full_name, email, status)")
    .eq("id", roundId).maybeSingle()
  return data as unknown as ReminderRound | null
}

/** Send one reminder, with a compare-and-claim update to avoid cron duplicates. */
export async function sendApplicationQuestionReminder(input: {
  roundId: string
  origin?: string
}): Promise<{ ok: boolean; skipped?: boolean; sent?: boolean; held?: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }
  const round = await loadReminderRound(input.roundId)
  const app = round?.application
  if (!round || !app) return { ok: false, error: "Question round not found" }
  if (round.status !== "Sent") return { ok: true, skipped: true }
  if (TERMINAL_STATUSES.includes(app.status) || !app.email) return { ok: true, skipped: true }
  if (round.reminder_count >= MAX_REMINDERS) {
    const held = await placeApplicationOnHold(round.application_id, app.reference_number, app.full_name)
    return { ok: true, skipped: true, held }
  }

  const now = new Date()
  const claimTime = now.toISOString()
  const staleClaimBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString()
  await supabase.from("creator_application_question_rounds")
    .update({ reminder_claimed_at: null, updated_at: claimTime })
    .eq("id", round.id).eq("status", "Sent").lt("reminder_claimed_at", staleClaimBefore)

  const { data: claimed } = await supabase.from("creator_application_question_rounds")
    .update({ reminder_claimed_at: claimTime, updated_at: claimTime })
    .eq("id", round.id).eq("status", "Sent").eq("reminder_count", round.reminder_count)
    .is("reminder_claimed_at", null).select("id").maybeSingle()
  if (!claimed) return { ok: true, skipped: true }

  const reminderNo = round.reminder_count + 1
  const url = `${siteUrl(input.origin)}/creator/questions/${round.token}`
  const isFinal = reminderNo === MAX_REMINDERS
  const subject = round.email_subject ? `Reminder — ${round.email_subject}` : `MartPoint Creator Network: Reminder — ${round.title}`
  const intro = round.email_intro || `This is reminder ${reminderNo} of ${MAX_REMINDERS} about the additional questions for your MartPoint Creator Network application ${app.reference_number || ""}.`
  const reminderNote = isFinal ? "This is the final reminder. If we do not receive your answers, your application will be placed on hold for follow-up with the MartPoint team." : "Your application remains under review while we wait for your answers."
  const text = `Hello ${app.full_name || "there"},\n\n${intro}\n\nThis is reminder ${reminderNo} of ${MAX_REMINDERS}.\n\nPlease answer them here:\n${url}\n\n${reminderNote}\n\nMartPoint Creator Network Team`
  const html = `<p>Hello ${escapeHtml(String(app.full_name || "there"))},</p>${escapeHtml(intro).replace(/\n/g, "<br />")}<p>This is reminder <strong>${reminderNo} of ${MAX_REMINDERS}</strong>.</p><p><a href="${url}">Answer the questions</a></p><p>${reminderNote}</p><p>MartPoint Creator Network Team</p>`
  const sent = await sendEmail({ to: app.email, subject, text, html, replyTo: REPLY_TO.digitals })
  await recordQuestionEmail({ roundId: round.id, applicationId: round.application_id, kind: "REMINDER", attemptNo: reminderNo, sent })

  const nextReminderAt = sent && reminderNo < MAX_REMINDERS
    ? new Date(Date.now() + REMINDER_INTERVAL_MS).toISOString()
    : sent ? null : new Date(Date.now() + REMINDER_INTERVAL_MS).toISOString()
  await supabase.from("creator_application_question_rounds").update({
    ...(sent ? { reminder_count: reminderNo, last_reminder_at: claimTime } : {}),
    next_reminder_at: nextReminderAt,
    reminder_claimed_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", round.id).eq("reminder_claimed_at", claimTime)

  let held = false
  if (sent && isFinal) {
    held = await placeApplicationOnHold(round.application_id, app.reference_number, app.full_name)
  }
  return { ok: true, sent, held }
}

/** Hourly job: due rounds are individually claimed, then reminded every three days. */
export async function runCreatorQuestionReminderSweep(origin?: string): Promise<{ scanned: number; sent: number; failed: number; held: number }> {
  if (!isSupabaseConfigured()) return { scanned: 0, sent: 0, failed: 0, held: 0 }
  const now = new Date().toISOString()
  const { data } = await supabase.from("creator_application_question_rounds")
    .select("id").eq("status", "Sent").lte("next_reminder_at", now).limit(100)
  let sent = 0
  let failed = 0
  let held = 0
  for (const row of data || []) {
    const result = await sendApplicationQuestionReminder({ roundId: row.id as string, origin })
    if (result.sent) sent++
    if (result.sent === false) failed++
    if (result.held) held++
  }
  return { scanned: data?.length || 0, sent, failed, held }
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

export const CREATOR_SAMPLE_QUESTION_PACKS: { key: string; title: string; description: string; emailSubject?: string; emailIntro?: string; fields: QuestionnaireField[] }[] = [
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
  {
    key: "video_follow_up",
    title: "Video Collaboration Follow-up",
    description: "Personal email for a creator who shared a MartPoint video on Instagram or TikTok; clarifies audience, origin, portfolio, onboarding and commercial expectations.",
    emailSubject: "A few follow-up questions about your MartPoint video",
    emailIntro: "Thank you for creating and sharing the MartPoint video on Instagram and TikTok. We appreciate the initiative and effort.\n\nAs we review your application and collaboration request, could you help us with a few things? These will help us clarify the next steps and expectations on both sides. Thank you!",
    fields: [
      { name: "vf_audience_bio", label: "Who do you mainly create content for, and what topics do you usually cover? Please also complete your Creator Profile bio.", type: "textarea", required: true },
      { name: "vf_scenario_inspiration", label: "What inspired the business-recordkeeping scenario in your video — something you experienced or observed?", type: "textarea", required: true },
      { name: "vf_other_videos", label: "Please share two other videos that best represent your work.", type: "textarea", required: true },
      { name: "vf_onboarding_brief", label: "Would you be comfortable completing a short MartPoint onboarding and working from a brief, with feedback before future content goes live?", type: "boolean", required: true },
      { name: "vf_original_video", label: "Do you have the original video without the TikTok watermark and outro?", type: "boolean", required: true },
      { name: "vf_engagement_type", label: "For this video, are you requesting an Instagram collaboration only, or proposing a paid engagement as well?", type: "select", required: true, options: ["Instagram collaboration only", "Paid engagement as well", "Open to discussing either"] },
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
