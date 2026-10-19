import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATUSES = new Set(["VERIFIED", "REVIEW_REQUIRED", "UNMATCHED", "CONFLICT"])

function authorized(request: Request): boolean {
  const configured = process.env.CENTRAL_IDENTITY_SYNC_SECRET || ""
  const supplied = request.headers.get("authorization") || ""
  const expected = `Bearer ${configured}`
  if (!configured || supplied.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const businessId = String(body.business_id || "")
  const fleetId = String(body.fleet_id || "")
  const installationId = String(body.installation_id || "")
  const status = String(body.identity_status || "").toUpperCase()
  if (!UUID.test(businessId) || !UUID.test(fleetId) || !UUID.test(installationId) || !STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid identity payload" }, { status: 400 })
  }
  if (status !== "VERIFIED") return NextResponse.json({ error: "Only verified identities can be synchronized" }, { status: 400 })

  const [fleetOwners, installationOwners] = await Promise.all([
    supabase.from("business_deployments").select("id, business_id").eq("fleet_id", fleetId),
    supabase.from("business_deployments").select("id, business_id").eq("installation_id", installationId),
  ])
  if (fleetOwners.error || installationOwners.error) return NextResponse.json({ error: "Identity ownership lookup failed" }, { status: 500 })
  const foreignOwner = [...(fleetOwners.data || []), ...(installationOwners.data || [])]
    .some((row) => row.business_id !== businessId)
  if (foreignOwner) return NextResponse.json({ error: "Identity is already owned by another business" }, { status: 409 })

  const { data: candidates, error: readError } = await supabase
    .from("business_deployments")
    .select("id, business_id, fleet_id, installation_id, identity_status")
    .eq("business_id", businessId)
  if (readError) return NextResponse.json({ error: "Identity lookup failed" }, { status: 500 })
  let matches = (candidates || []).filter((row) =>
    (row.fleet_id === fleetId || row.installation_id === installationId) &&
    (!row.fleet_id || row.fleet_id === fleetId) &&
    (!row.installation_id || row.installation_id === installationId)
  )
  if (matches.length === 0) {
    const unassigned = (candidates || []).filter((row) => !row.fleet_id && !row.installation_id)
    if (unassigned.length === 1) matches = unassigned
  }
  if (matches.length !== 1) {
    return NextResponse.json({ error: matches.length ? "Conflicting deployment identity" : "Matching deployment not found" }, { status: 409 })
  }
  const current = matches[0]
  const update = {
    fleet_id: fleetId,
    installation_id: installationId,
    identity_status: "VERIFIED",
    identity_verified_at: new Date().toISOString(),
    identity_last_reconciled_at: new Date().toISOString(),
    identity_issue: null,
  }
  const { error: updateError } = await supabase.from("business_deployments").update(update).eq("id", current.id)
  if (updateError) return NextResponse.json({ error: "Identity update failed" }, { status: 500 })
  const { error: auditError } = await supabase.from("business_identity_audit").insert({
    business_id: businessId,
    deployment_id: current.id,
    action: "CENTRAL_VERIFIED_SYNC",
    identity_status: "VERIFIED",
    fleet_id: fleetId,
    installation_id: installationId,
    actor_id: null,
    metadata: { source: "central_reconciliation", idempotent: current.identity_status === "VERIFIED" },
  })
  if (auditError) return NextResponse.json({ error: "Identity audit failed" }, { status: 500 })
  return NextResponse.json({ ok: true, idempotent: current.identity_status === "VERIFIED" })
}
