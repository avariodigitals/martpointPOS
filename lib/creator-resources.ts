/* ───────────────────────────  Creator Kit + guides + FAQs + KB links  ───────────────────────────
 * CMS-managed content for the creator portal: downloadable/viewable resources,
 * business-type Creator Guides (keyed to lib/industries.ts slugs), creator FAQs
 * and curated public Knowledge Base links. Nothing is hard-coded — all rows are
 * admin-managed.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { trackCreatorEvent } from "./creator-analytics"
import { createCreatorFileSignedUrl } from "./creator-storage"
import type { ContentStatus, CreatorFaqCategory, ResourceCategory, ResourceType } from "./creator-constants"

/* ─── Creator Kit resources ─── */

export interface CreatorResource {
  id: string
  name: string
  description: string | null
  category: ResourceCategory
  resourceType: ResourceType
  filePath: string | null
  externalUrl: string | null
  previewPath: string | null
  version: string | null
  usageNotes: string | null
  publishedAt: string | null
  active: boolean
  sortOrder: number
  downloadCount: number
}

const RESOURCE_SELECT =
  "id, name, description, category, resource_type, file_path, external_url, " +
  "preview_path, version, usage_notes, published_at, active, sort_order, download_count"

function mapResource(row: Record<string, unknown>): CreatorResource {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category: row.category as ResourceCategory,
    resourceType: (row.resource_type as ResourceType) ?? "FILE",
    filePath: (row.file_path as string) ?? null,
    externalUrl: (row.external_url as string) ?? null,
    previewPath: (row.preview_path as string) ?? null,
    version: (row.version as string) ?? null,
    usageNotes: (row.usage_notes as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    active: !!row.active,
    sortOrder: (row.sort_order as number) ?? 0,
    downloadCount: (row.download_count as number) ?? 0,
  }
}

export async function listResources(opts: { activeOnly?: boolean } = {}): Promise<CreatorResource[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("creator_resources").select(RESOURCE_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
  if (opts.activeOnly) q = q.eq("active", true)
  const { data } = await q
  return (((data || []) as unknown as Record<string, unknown>[])).map(mapResource)
}

export interface ResourceInput {
  name: string
  description?: string | null
  category: ResourceCategory
  resourceType: ResourceType
  filePath?: string | null
  externalUrl?: string | null
  previewPath?: string | null
  version?: string | null
  usageNotes?: string | null
  active?: boolean
  sortOrder?: number
}

export async function saveResource(
  input: ResourceInput,
  userId: string | null,
  id?: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const row = {
    name: input.name.trim(),
    description: input.description ?? null,
    category: input.category,
    resource_type: input.resourceType,
    file_path: input.filePath ?? null,
    external_url: input.externalUrl ?? null,
    preview_path: input.previewPath ?? null,
    version: input.version ?? null,
    usage_notes: input.usageNotes ?? null,
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
    published_at: new Date().toISOString(),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  const query = id
    ? supabase.from("creator_resources").update(row).eq("id", id)
    : supabase.from("creator_resources").insert({ ...row, created_by: userId })
  const { data, error } = await query.select("id").single()
  if (error) return { error: error.message }
  return { id: data?.id as string }
}

export async function deleteResource(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("creator_resources").delete().eq("id", id)
  return error ? { error: error.message } : {}
}

/** Creator-side view/download: returns a signed URL (files) or the external URL. */
export async function openResource(
  creatorId: string,
  resourceId: string,
  kind: "view" | "download"
): Promise<{ url?: string; external?: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const { data } = await supabase
    .from("creator_resources")
    .select("file_path, external_url, active, download_count")
    .eq("id", resourceId)
    .maybeSingle()
  if (!data || !data.active) return { error: "Resource not found" }

  let url: string | null = null
  if (data.external_url) {
    url = data.external_url as string
  } else if (data.file_path) {
    url = await createCreatorFileSignedUrl(data.file_path as string, 300)
  }
  if (!url) return { error: "Resource has no file or link" }

  if (kind === "download") {
    void supabase
      .from("creator_resources")
      .update({ download_count: ((data.download_count as number) ?? 0) + 1 })
      .eq("id", resourceId)
      .then(() => {})
  }
  void trackCreatorEvent(
    creatorId,
    kind === "download" ? "RESOURCE_DOWNLOADED" : "RESOURCE_VIEWED",
    { type: "resource", id: resourceId }
  )
  return { url, external: !!data.external_url }
}

/* ─── Business-type Creator Guides ─── */

export interface BusinessGuide {
  id: string
  industrySlug: string
  title: string
  overview: string | null
  commonProblems: string[]
  howHelps: string | null
  features: string[]
  contentAngles: string[]
  hooks: string[]
  useCases: string[]
  claimsToAvoid: string[]
  recommendedCta: string | null
  relatedLinks: { label: string; url: string }[]
  status: ContentStatus
  sortOrder: number
}

const GUIDE_SELECT =
  "id, industry_slug, title, overview, common_problems, how_helps, features, " +
  "content_angles, hooks, use_cases, claims_to_avoid, recommended_cta, " +
  "related_links, status, sort_order"

function mapGuide(row: Record<string, unknown>): BusinessGuide {
  return {
    id: row.id as string,
    industrySlug: row.industry_slug as string,
    title: row.title as string,
    overview: (row.overview as string) ?? null,
    commonProblems: (row.common_problems as string[]) ?? [],
    howHelps: (row.how_helps as string) ?? null,
    features: (row.features as string[]) ?? [],
    contentAngles: (row.content_angles as string[]) ?? [],
    hooks: (row.hooks as string[]) ?? [],
    useCases: (row.use_cases as string[]) ?? [],
    claimsToAvoid: (row.claims_to_avoid as string[]) ?? [],
    recommendedCta: (row.recommended_cta as string) ?? null,
    relatedLinks: (row.related_links as { label: string; url: string }[]) ?? [],
    status: row.status as ContentStatus,
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

export async function listGuides(opts: { publishedOnly?: boolean } = {}): Promise<BusinessGuide[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("creator_business_guides").select(GUIDE_SELECT)
    .order("sort_order", { ascending: true })
  if (opts.publishedOnly) q = q.eq("status", "PUBLISHED")
  const { data } = await q
  return (((data || []) as unknown as Record<string, unknown>[])).map(mapGuide)
}

export async function getGuideBySlug(
  industrySlug: string,
  opts: { publishedOnly?: boolean } = {}
): Promise<BusinessGuide | null> {
  if (!isSupabaseConfigured()) return null
  let q = supabase.from("creator_business_guides").select(GUIDE_SELECT).eq("industry_slug", industrySlug)
  if (opts.publishedOnly) q = q.eq("status", "PUBLISHED")
  const { data } = await q.maybeSingle()
  return data ? mapGuide(data as unknown as Record<string, unknown>) : null
}

export interface GuideInput extends Omit<BusinessGuide, "id" | "sortOrder"> {
  sortOrder?: number
}

export async function saveGuide(
  input: GuideInput,
  userId: string | null,
  id?: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const row = {
    industry_slug: input.industrySlug,
    title: input.title.trim(),
    overview: input.overview ?? null,
    common_problems: input.commonProblems,
    how_helps: input.howHelps ?? null,
    features: input.features,
    content_angles: input.contentAngles,
    hooks: input.hooks,
    use_cases: input.useCases,
    claims_to_avoid: input.claimsToAvoid,
    recommended_cta: input.recommendedCta ?? null,
    related_links: input.relatedLinks,
    status: input.status ?? "DRAFT",
    sort_order: input.sortOrder ?? 0,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  const query = id
    ? supabase.from("creator_business_guides").update(row).eq("id", id)
    : supabase.from("creator_business_guides").insert({ ...row, created_by: userId })
  const { data, error } = await query.select("id").single()
  if (error) return { error: error.message.includes("duplicate") ? "A guide already exists for this business type" : error.message }
  return { id: data?.id as string }
}

export async function deleteGuide(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("creator_business_guides").delete().eq("id", id)
  return error ? { error: error.message } : {}
}

/* ─── Creator FAQs ─── */

export interface CreatorFaq {
  id: string
  question: string
  answer: string
  category: CreatorFaqCategory
  sortOrder: number
  status: ContentStatus
}

function mapFaq(row: Record<string, unknown>): CreatorFaq {
  return {
    id: row.id as string,
    question: row.question as string,
    answer: row.answer as string,
    category: row.category as CreatorFaqCategory,
    sortOrder: (row.sort_order as number) ?? 0,
    status: row.status as ContentStatus,
  }
}

export async function listFaqs(opts: { publishedOnly?: boolean } = {}): Promise<CreatorFaq[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("creator_faqs").select("*")
    .order("sort_order", { ascending: true })
  if (opts.publishedOnly) q = q.eq("status", "PUBLISHED")
  const { data } = await q
  return (data || []).map(mapFaq)
}

export async function saveFaq(
  input: { question: string; answer: string; category: CreatorFaqCategory; sortOrder?: number; status?: ContentStatus },
  userId: string | null,
  id?: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const row = {
    question: input.question.trim(),
    answer: input.answer,
    category: input.category,
    sort_order: input.sortOrder ?? 0,
    status: input.status ?? "PUBLISHED",
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  const query = id
    ? supabase.from("creator_faqs").update(row).eq("id", id)
    : supabase.from("creator_faqs").insert({ ...row, created_by: userId })
  const { data, error } = await query.select("id").single()
  if (error) return { error: error.message }
  return { id: data?.id as string }
}

export async function deleteFaq(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("creator_faqs").delete().eq("id", id)
  return error ? { error: error.message } : {}
}

/* ─── Curated KB links ─── */

export interface KbLink {
  id: string
  title: string
  description: string | null
  url: string
  category: string
  sortOrder: number
  active: boolean
}

function mapKbLink(row: Record<string, unknown>): KbLink {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    url: row.url as string,
    category: (row.category as string) ?? "GENERAL",
    sortOrder: (row.sort_order as number) ?? 0,
    active: !!row.active,
  }
}

export async function listKbLinks(opts: { activeOnly?: boolean } = {}): Promise<KbLink[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("creator_kb_links").select("*").order("sort_order", { ascending: true })
  if (opts.activeOnly) q = q.eq("active", true)
  const { data } = await q
  return (data || []).map(mapKbLink)
}

export async function saveKbLink(
  input: { title: string; description?: string | null; url: string; category?: string; sortOrder?: number; active?: boolean },
  userId: string | null,
  id?: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const row = {
    title: input.title.trim(),
    description: input.description ?? null,
    url: input.url.trim(),
    category: input.category ?? "GENERAL",
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
    ...(id ? {} : { created_by: userId }),
  }
  const query = id
    ? supabase.from("creator_kb_links").update(row).eq("id", id)
    : supabase.from("creator_kb_links").insert(row)
  const { data, error } = await query.select("id").single()
  if (error) return { error: error.message }
  return { id: data?.id as string }
}

export async function deleteKbLink(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("creator_kb_links").delete().eq("id", id)
  return error ? { error: error.message } : {}
}
