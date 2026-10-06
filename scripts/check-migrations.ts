/**
 * Migration drift check — compares the SQL migrations in `supabase/migrations`
 * against the LIVE database schema and reports anything that was never applied.
 *
 * What it checks (best-effort, via the PostgREST OpenAPI schema):
 *   - Missing tables  (CREATE TABLE ... with no matching live table)
 *   - Missing columns (ALTER TABLE ... ADD COLUMN ... not present live)
 *
 * It does NOT verify enums, CHECK constraints, indexes, RLS policies or RPC
 * functions — PostgREST does not expose enough detail for those. Missing
 * indexes/constraints usually affect performance/validation rather than
 * breaking features, so they are intentionally out of scope.
 *
 * Usage:
 *   npx tsx scripts/check-migrations.ts
 *
 * Environment: reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY from .env.local / .env.
 *
 * Exit code: 0 = no drift, 1 = drift found (safe to use in CI / pre-deploy).
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { readFileSync, readdirSync } from "fs"
import { join } from "path"

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""

interface Issue {
  kind: "table" | "column"
  name: string
  migration: string
}

/** Column names for every table, from the live PostgREST OpenAPI schema. */
async function fetchLiveSchema(): Promise<Map<string, Set<string>>> {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`Could not read PostgREST schema: HTTP ${res.status}`)
  const spec = (await res.json()) as { definitions?: Record<string, { properties?: Record<string, unknown> }> }
  const out = new Map<string, Set<string>>()
  for (const [name, def] of Object.entries(spec.definitions || {})) {
    out.set(name, new Set(Object.keys(def.properties || {})))
  }
  return out
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
}

function auditFile(file: string, sql: string, live: Map<string, Set<string>>): Issue[] {
  const issues: Issue[] = []

  // CREATE TABLE [IF NOT EXISTS] name
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
    const table = m[1].toLowerCase()
    if (!live.has(table)) issues.push({ kind: "table", name: table, migration: file })
  }

  // ALTER TABLE <t> ... ADD COLUMN [IF NOT EXISTS] <c>  (multi-add aware)
  for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+([\s\S]*?);/gi)) {
    const table = m[1].toLowerCase()
    const body = m[2]
    const liveCols = live.get(table)
    for (const c of body.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
      const col = c[1].toLowerCase()
      if (col === "if") continue // guard against "IF NOT EXISTS" being captured
      if (!liveCols) {
        issues.push({ kind: "table", name: table, migration: file })
        continue
      }
      if (liveCols.size > 0 && !liveCols.has(col)) issues.push({ kind: "column", name: `${table}.${col}`, migration: file })
    }
  }

  return issues
}

async function main() {
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked .env.local and .env).")
    process.exit(2)
  }

  const live = await fetchLiveSchema()
  console.log(`Live schema: ${live.size} tables. Auditing migrations in ${MIGRATIONS_DIR} ...\n`)

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
  const issues: Issue[] = []
  for (const f of files) {
    const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    issues.push(...auditFile(f, sql, live))
  }

  if (issues.length === 0) {
    console.log(`✅ No drift. All ${files.length} migrations are reflected in the live schema.`)
    process.exit(0)
  }

  const missingTables = issues.filter((i) => i.kind === "table")
  const missingCols = issues.filter((i) => i.kind === "column")

  if (missingTables.length) {
    console.log("❌ MISSING TABLES")
    for (const i of missingTables) console.log(`   ${i.name}   (${i.migration})`)
    console.log("")
  }
  if (missingCols.length) {
    console.log("❌ MISSING COLUMNS")
    for (const i of missingCols) console.log(`   ${i.name}   (${i.migration})`)
    console.log("")
  }

  console.log(`${issues.length} drift issue(s) found. Apply the migrations above in Supabase → SQL Editor.`)
  process.exit(1)
}

main().catch((err) => {
  console.error("Migration check failed:", err instanceof Error ? err.message : err)
  process.exit(2)
})
