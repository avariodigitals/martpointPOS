import { NextResponse } from "next/server"
import { authorizeAdmin, getSession } from "@/lib/admin-auth"
import { hasPermission } from "@/lib/admin-types"
import { isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  getRoleTemplate,
  listTemplateVersions,
  updateRoleTemplate,
  archiveRoleTemplate,
  templateToVacancyPrefill,
} from "@/lib/careers-role-templates"
import { buildTemplateRow, type RoleTemplateInput } from "../route"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* GET: template detail + version history. Compensation fields are only
 * included when the caller can see careers.compensation.view. */
export async function GET(request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.role_templates.view")
  if (denied) return denied
  const { id } = await ctx.params
  const template = await getRoleTemplate(id)
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const versions = await listTemplateVersions(id)

  // Strip sensitive compensation detail for roles without compensation.view.
  const session = await getSession()
  const canSeeComp = session?.role === "Admin" || (session && hasPermission(session.role, "careers.compensation.view"))
  const safe = canSeeComp
    ? template
    : {
        ...template,
        base_compensation_kobo: null,
        transport_allowance_kobo: null,
        data_call_allowance_kobo: null,
        commission_rules: {},
        performance_bonus: null,
      }

  // Vacancy prefill for the "create vacancy from template" flow.
  const { searchParams } = new URL(request.url)
  const prefill = searchParams.get("prefill") === "1" ? templateToVacancyPrefill(safe) : undefined

  return NextResponse.json({ template: safe, versions, prefill })
}

/* PATCH: update template (bumps version + snapshot). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.role_templates.edit")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const input = (await request.json().catch(() => ({}))) as RoleTemplateInput
  const { row, error } = buildTemplateRow(input)
  if (error || !row) return NextResponse.json({ error: error || "Invalid input" }, { status: 400 })

  const { version, error: upErr } = await updateRoleTemplate(id, row, { id: session.userId, name: session.name })
  if (upErr) return NextResponse.json({ error: upErr === "Template not found" ? upErr : "Failed to update template" }, { status: upErr === "Template not found" ? 404 : 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_ROLE_TEMPLATE_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_ROLE_TEMPLATE,
    entityId: id,
    metadata: { name: row.name, version },
  })
  return NextResponse.json({ success: true, version })
}

/* DELETE: archive the template. */
export async function DELETE(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.role_templates.archive")
  if (denied) return denied
  const { id } = await ctx.params
  const { error } = await archiveRoleTemplate(id, { id: session.userId })
  if (error) return NextResponse.json({ error: "Failed to archive" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_ROLE_TEMPLATE_ARCHIVED,
    entityType: AUDIT_ENTITIES.CAREER_ROLE_TEMPLATE,
    entityId: id,
  })
  return NextResponse.json({ success: true })
}
