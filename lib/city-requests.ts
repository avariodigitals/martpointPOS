import { supabase, isSupabaseConfigured } from "./supabase"
import { createAdminNotification } from "./admin-notifications"
import { getAllUsers } from "./admin-auth"
import { getCitiesForState } from "./locations"

export type CityRequestStatus = "pending" | "approved" | "rejected"

export type CityRequest = {
  id: string
  country: string
  state: string
  city: string
  status: CityRequestStatus
  requested_by: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

/**
 * True when the city is already in the canonical list for (country, state) —
 * i.e. no authorisation is required.
 */
export function isKnownCity(country: string, state: string, city: string): boolean {
  const cities = getCitiesForState(country, state)
  return cities.some((c) => c.toLowerCase() === (city || "").trim().toLowerCase())
}

function mapRow(row: Record<string, unknown>): CityRequest {
  return {
    id: row.id as string,
    country: row.country as string,
    state: row.state as string,
    city: row.city as string,
    status: row.status as CityRequestStatus,
    requested_by: (row.requested_by as string) ?? null,
    created_at: row.created_at as string,
    resolved_at: (row.resolved_at as string) ?? null,
    resolved_by: (row.resolved_by as string) ?? null,
  }
}

/** Record a custom city that needs admin authorisation and route a notification. */
export async function requestCityAuthorization(input: {
  country: string
  state: string
  city: string
  requestedBy?: string | null
}): Promise<void> {
  const city = (input.city || "").trim()
  if (!input.country || !input.state || !city) return
  if (isKnownCity(input.country, input.state, city)) return

  if (!isSupabaseConfigured()) return

  // Dedupe: don't fire a new request/notification for an already-known pending/approved city.
  const existing = await supabase
    .from("city_requests")
    .select("id, status")
    .ilike("city", city)
    .eq("country", input.country)
    .eq("state", input.state)
    .maybeSingle()
  if (existing?.data) return

  const inserted = await supabase
    .from("city_requests")
    .insert({
      country: input.country,
      state: input.state,
      city,
      status: "pending",
      requested_by: input.requestedBy || null,
    })
    .select("id")
    .single()

  // Route a notification to every Admin user (best-effort).
  try {
    const admins = (await getAllUsers()).filter((u) => u.role === "Admin" && u.status === "ACTIVE")
    for (const admin of admins) {
      await createAdminNotification({
        admin_user_id: admin.id,
        type: "city_request",
        title: "New city awaiting authorisation",
        message: `${city}, ${input.state} (${input.country}) was submitted and is not in the city list. Approve or edit the spelling to adopt it.`,
        deep_link: "/admin/city-requests",
        source_type: "city_request",
        source_id: inserted?.data?.id ?? undefined,
      })
    }
  } catch (e) {
    console.error("[city-requests] notification failed", e)
  }
}

export async function listCityRequests(options?: { status?: CityRequestStatus }): Promise<CityRequest[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("city_requests")
    .select("*")
    .order("created_at", { ascending: false })
  if (options?.status) q = q.eq("status", options.status)
  const { data, error } = await q
  if (error) throw new Error(`City request list failed: ${error.message}`)
  return (data || []).map(mapRow)
}

/** Approve (optionally with corrected spelling) — adopts the city into the list. */
export async function approveCityRequest(input: {
  id: string
  correctedCity?: string
  resolvedBy?: string
}): Promise<CityRequest> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const city = (input.correctedCity || "").trim()
  const update: Record<string, unknown> = {
    status: "approved",
    resolved_at: new Date().toISOString(),
    resolved_by: input.resolvedBy || null,
  }
  if (city) update.city = city
  const { data, error } = await supabase
    .from("city_requests")
    .update(update)
    .eq("id", input.id)
    .select()
    .single()
  if (error || !data) throw new Error(`City approval failed: ${error?.message || "unknown"}`)
  return mapRow(data)
}

export async function rejectCityRequest(input: {
  id: string
  resolvedBy?: string
}): Promise<CityRequest> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data, error } = await supabase
    .from("city_requests")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: input.resolvedBy || null,
    })
    .eq("id", input.id)
    .select()
    .single()
  if (error || !data) throw new Error(`City rejection failed: ${error?.message || "unknown"}`)
  return mapRow(data)
}

/** Approved (adopted) cities for a country/state — merged into public dropdowns. */
export async function listApprovedCities(country: string, state: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("city_requests")
    .select("city")
    .eq("country", country)
    .eq("state", state)
    .eq("status", "approved")
  if (error) return []
  return [...new Set((data || []).map((r) => r.city as string))]
}
