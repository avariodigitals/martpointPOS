/* Creator Support acceptance suite — runs against the deployed app + DB.
 * Uses signed session cookies (SESSION_SECRET) for real API calls and the
 * service-role REST endpoint for DB-level constraint/audit assertions.
 */
import crypto from "crypto"

const BASE = process.env.BASE_URL || "https://www.martpoint.com.ng"
const SUPA = process.env.SUPABASE_URL || ""
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const SECRET = process.env.SESSION_SECRET || ""

const CREATOR = { id: "5a8e0af2-46b3-49f2-9164-09bb4bfdb357", email: "adaeze.okafor.demo@example.com", name: "Adaeze Okafor" }
const ADMIN = { userId: "3f0b41f8-6b0c-4ee1-91c3-ce0aee80d1c3", username: "admin", role: "Admin", name: "Administrator" }
const BUSINESS_ID = "e8e60242-4df3-4873-835d-58204cd30bdf" // Bitsbytee

function sign(payload: object): string {
  const data = JSON.stringify(payload)
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex")
  return Buffer.from(`${data}.${sig}`).toString("base64")
}
const creatorCookie = `creator-session=${sign({ creatorId: CREATOR.id, email: CREATOR.email, name: CREATOR.name, sessionVersion: 1 })}`
const adminCookie = `admin-session=${sign(ADMIN)}`

async function api(path: string, cookie: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { cookie: cookie, "Content-Type": "application/json", ...(init?.headers || {}) } })
  let body: any = null
  try { body = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, body }
}

async function db(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers || {}) } })
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`) }
}

const adminTicketAction = (payload: object) => api("/api/admin/support/tickets", adminCookie, { method: "POST", body: JSON.stringify(payload) })

async function main() {
  console.log(`\n=== Creator Support acceptance — ${BASE} ===\n`)

  /* ── 1. Constraint negatives (DB level) ── */
  console.log("1. Ownership/integrity constraints")
  const baseTicket = { created_by_type: "ADMIN", source: "PORTAL", priority: "NORMAL", status: "NEW", subject: "QA constraint test" }
  let r = await db("support_tickets", { method: "POST", body: JSON.stringify({ ...baseTicket, category: "SOFTWARE" }) })
  check("ownerless ticket rejected", r.status >= 400, JSON.stringify(r.body)?.slice(0, 100))
  r = await db("support_tickets", { method: "POST", body: JSON.stringify({ ...baseTicket, business_id: BUSINESS_ID, creator_id: CREATOR.id, category: "SOFTWARE" }) })
  check("double-owned ticket rejected", r.status >= 400)
  r = await db("support_tickets", { method: "POST", body: JSON.stringify({ ...baseTicket, creator_id: CREATOR.id, category: "SOFTWARE" }) })
  check("creator ticket w/ wrong category rejected", r.status >= 400)
  r = await db("support_tickets", { method: "POST", body: JSON.stringify({ ...baseTicket, business_id: BUSINESS_ID, category: "CREATOR_NETWORK" }) })
  check("business ticket w/ CREATOR_NETWORK rejected", r.status >= 400)

  /* ── 2. Creator creates ticket via API ── */
  console.log("2. Creator ticket creation")
  let ticketId = process.env.EXISTING_TICKET_ID
  let ticketNumber = ""
  if (!ticketId) {
    r = await api("/api/creator/support/tickets", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ topic: "Learning & Onboarding", subject: "QA acceptance: cannot complete assessment", message: "QA acceptance test ticket — the assessment submit button spins forever on my phone." }),
    })
    check("creator POST ticket 200", r.status === 200, JSON.stringify(r.body))
    ticketId = r.body?.ticketId
    ticketNumber = r.body?.ticketNumber
    console.log(`  → ticket ${ticketNumber}`)
  } else {
    console.log(`  → reusing ticket ${ticketId}`)
  }

  r = await db(`support_tickets?id=eq.${ticketId}&select=id,ticket_number,category,creator_id,business_id,status,created_by_type`)
  const row = r.body?.[0]
  check("DB row: creator-owned, CREATOR_NETWORK, business_id null", !!row && row.creator_id === CREATOR.id && row.business_id === null && row.category === "CREATOR_NETWORK" && row.created_by_type === "CREATOR")

  /* ── 3. Admin sees it under CREATOR_NETWORK with identity ── */
  console.log("3. Admin listing")
  r = await api("/api/admin/support/tickets?category=CREATOR_NETWORK", adminCookie)
  const list = Array.isArray(r.body?.data) ? r.body.data : []
  const listed = list.find((t: any) => t.id === ticketId)
  check("ticket in admin CREATOR_NETWORK list", !!listed, `status=${r.status} count=${list.length}`)
  if (listed) {
    check("creator identity joined (name + MPC id)", listed.creator?.full_name === "Adaeze Okafor" && listed.creator?.creator_id === "MPC-00001", JSON.stringify(listed.creator))
  }

  /* ── 4. Admin reply → creator notification ── */
  console.log("4. Admin reply → creator in-portal notification")
  const notifsBefore = ((await db(`creator_notifications?creator_id=eq.${CREATOR.id}&type=eq.SUPPORT&select=id`)).body || []).length
  r = await api("/api/admin/support/messages", adminCookie, {
    method: "POST",
    body: JSON.stringify({ action: "create", data: { ticketId, message: "QA reply: thanks for flagging — we're looking into the assessment button.", visibility: "PUBLIC" } }),
  })
  check("admin PUBLIC reply accepted", r.status === 200, JSON.stringify(r.body)?.slice(0, 150))
  const notifs = (await db(`creator_notifications?creator_id=eq.${CREATOR.id}&type=eq.SUPPORT&select=id,title,link&order=created_at.desc`)).body
  check("creator SUPPORT notification created", (notifs?.length || 0) > notifsBefore, JSON.stringify(notifs?.slice(0, 1)))
  if (notifs?.[0]) check("notification links to ticket", notifs[0].link === `/creator/support/${ticketId}`, notifs[0].link)

  /* ── 5. Creator reply → thread complete ── */
  console.log("5. Creator reply")
  r = await api(`/api/creator/support/tickets/${ticketId}/messages`, creatorCookie, {
    method: "POST",
    body: JSON.stringify({ message: "QA reply from creator — happens on Chrome Android, lesson 11." }),
  })
  check("creator reply 200", r.status === 200, JSON.stringify(r.body))
  r = await api(`/api/creator/support/tickets/${ticketId}`, creatorCookie)
  check("thread has both sides (3 msgs)", (r.body?.messages?.length || 0) >= 3, `msgs=${r.body?.messages?.length}`)

  /* ── 6. Status lifecycle ── */
  console.log("6. Status lifecycle (admin)")
  r = await adminTicketAction({ action: "assign_admin", data: { id: ticketId, adminUserId: ADMIN.userId } })
  check("assign_admin", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
  for (const s of ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"]) {
    r = await adminTicketAction({ action: "change_status", data: { id: ticketId, status: s } })
    check(`status → ${s}`, r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
  }
  // creator reply on RESOLVED re-opens to IN_PROGRESS per lib logic
  await api(`/api/creator/support/tickets/${ticketId}/messages`, creatorCookie, { method: "POST", body: JSON.stringify({ message: "QA: still broken, reopening." }) })
  r = await db(`support_tickets?id=eq.${ticketId}&select=status`)
  check("creator reply on RESOLVED re-opens → IN_PROGRESS", r.body?.[0]?.status === "IN_PROGRESS", r.body?.[0]?.status)

  /* ── 7. Isolation ── */
  console.log("7. Isolation")
  r = await adminTicketAction({ action: "create", data: { business_id: BUSINESS_ID, category: "SOFTWARE", priority: "NORMAL", subject: "QA regression business ticket", description: "regression" } })
  const bizTicketId = r.body?.data?.id
  check("business ticket created (regression path)", !!bizTicketId, JSON.stringify(r.body)?.slice(0, 150))
  r = await api(`/api/creator/support/tickets/${bizTicketId}`, creatorCookie)
  check("creator cannot open business ticket", r.status === 404, `status=${r.status}`)
  r = await api(`/api/creator/support/tickets/${bizTicketId}/messages`, creatorCookie, { method: "POST", body: JSON.stringify({ message: "idor attempt" }) })
  check("creator cannot reply to business ticket", r.status === 400 || r.status === 404, `status=${r.status}`)
  r = await api("/api/creator/support/tickets", creatorCookie)
  check("creator list excludes business ticket", !(r.body?.tickets || []).some((t: any) => t.id === bizTicketId))

  /* ── 8. Creator delete restricted ── */
  console.log("8. RESTRICT on creator delete")
  r = await db(`creators?id=eq.${CREATOR.id}`, { method: "DELETE" })
  check("creator delete with tickets fails", r.status >= 400, `${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`)

  /* ── 9. Audit persistence ── */
  console.log("9. Audit/events persisted")
  r = await db(`support_ticket_events?ticket_id=eq.${ticketId}&select=event_type,actor_type&order=created_at`)
  const types = (r.body || []).map((e: any) => `${e.event_type}:${e.actor_type}`)
  check("events persisted incl CREATED:CREATOR", types.includes("CREATED:CREATOR"), JSON.stringify(types))
  r = await db(`finance_audit_events?entity_id=eq.${ticketId}&select=action,actor_type&order=created_at`)
  const auditActors = (r.body || []).map((e: any) => e.actor_type)
  check("finance audit persisted for CREATOR+ADMIN", auditActors.includes("CREATOR") && auditActors.includes("ADMIN"), JSON.stringify(auditActors))

  /* ── 10. Broadcasts ── */
  console.log("10. Broadcast audiences")
  r = await api("/api/admin/creators/broadcast", adminCookie)
  check("broadcast meta 200", r.status === 200, JSON.stringify(r.body))
  r = await api("/api/admin/creators/broadcast", adminCookie, { method: "POST", body: JSON.stringify({ audience: "CHALLENGE", challengeId: crypto.randomUUID(), title: "QA", body: "no participants expected" }) })
  check("CHALLENGE w/ no participants → 400", r.status === 400, JSON.stringify(r.body))
  r = await api("/api/admin/creators/broadcast", adminCookie, { method: "POST", body: JSON.stringify({ audience: "SELECTED", creatorIds: [CREATOR.id], title: "QA broadcast", body: "selected-creator test", sendEmail: true }) })
  check("SELECTED sends (recipients=1)", r.status === 200 && r.body?.recipients === 1, JSON.stringify(r.body))
  r = await api("/api/admin/creators/broadcast", adminCookie, { method: "POST", body: JSON.stringify({ audience: "READY", title: "QA ready-only", body: "ready audience test" }) })
  check("READY handled", r.status === 200 || r.status === 400, JSON.stringify(r.body))
  r = await api("/api/admin/creators/broadcast", adminCookie, { method: "POST", body: JSON.stringify({ audience: "ALL", title: "QA all-creators", body: "all audience test" }) })
  check("ALL sends", r.status === 200, JSON.stringify(r.body))

  /* ── 11. Business ticket regression ── */
  console.log("11. Business ticket regression")
  r = await api("/api/admin/support/messages", adminCookie, { method: "POST", body: JSON.stringify({ action: "create", data: { ticketId: bizTicketId, message: "regression reply", visibility: "PUBLIC" } }) })
  check("admin reply on business ticket", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
  r = await adminTicketAction({ action: "change_status", data: { id: bizTicketId, status: "CLOSED" } })
  check("business ticket closes", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))

  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  console.log(`Creator ticket: ${ticketId} (${ticketNumber})`)
  console.log(`Business regression ticket: ${bizTicketId}`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
