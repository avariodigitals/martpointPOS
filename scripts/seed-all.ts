/**
 * Seed ALL data from local JSON into Supabase
 * Run: npx tsx scripts/seed-all.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seedSettings() {
  const settingsPath = path.join(process.cwd(), "data", "settings.json")
  if (!fs.existsSync(settingsPath)) return
  const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: "id" })
  if (error) throw new Error(`Settings seed failed: ${error.message}`)
  console.log("✅ Settings seeded")
}

async function seedLeads() {
  const leadsPath = path.join(process.cwd(), "data", "leads.json")
  if (!fs.existsSync(leadsPath)) return
  const raw = JSON.parse(fs.readFileSync(leadsPath, "utf-8"))
  const leads = raw.leads || []
  if (leads.length === 0) return

  const rows = leads.map((l: Record<string, unknown>) => ({
    id: l.id,
    full_name: l.fullName,
    business_name: l.businessName,
    email: l.email,
    phone: l.phone,
    business_type: l.businessType,
    product_interest: l.productInterest,
    branches: l.branches,
    staff_size: l.staffSize,
    challenge: l.challenge || "",
    message: l.message || "",
    source: l.source || "website",
    status: l.status || "New",
    assigned_to: l.assignedTo || "",
    notes: l.notes || "",
    submitted_at: l.submittedAt,
    updated_at: l.updatedAt,
  }))

  const { error } = await supabase.from("leads").upsert(rows, { onConflict: "id" })
  if (error) throw new Error(`Leads seed failed: ${error.message}`)
  console.log(`✅ ${rows.length} lead(s) seeded`)
}

async function seedUsers() {
  const usersPath = path.join(process.cwd(), "data", "users.json")
  if (!fs.existsSync(usersPath)) return
  const raw = JSON.parse(fs.readFileSync(usersPath, "utf-8"))
  const users = raw.users || []
  if (users.length === 0) return

  const rows = users.map((u: Record<string, unknown>) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    password_hash: u.passwordHash,
    role: u.role,
    created_at: u.createdAt,
  }))

  const { error } = await supabase.from("users").upsert(rows, { onConflict: "id" })
  if (error) throw new Error(`Users seed failed: ${error.message}`)
  console.log(`✅ ${rows.length} user(s) seeded`)
}

async function seedBlog() {
  const blogPath = path.join(process.cwd(), "data", "blog.json")
  if (!fs.existsSync(blogPath)) return
  const raw = JSON.parse(fs.readFileSync(blogPath, "utf-8"))
  const posts = raw.posts || []
  if (posts.length === 0) return

  const rows = posts.map((p: Record<string, unknown>) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    cover_image: p.coverImage,
    category: p.category,
    author: p.author,
    published_at: p.publishedAt,
    status: p.status,
    meta_description: p.metaDescription,
    keywords: p.keywords,
  }))

  const { error } = await supabase.from("blog_posts").upsert(rows, { onConflict: "id" })
  if (error) throw new Error(`Blog seed failed: ${error.message}`)
  console.log(`✅ ${rows.length} blog post(s) seeded`)
}

async function seedFaqs() {
  const faqsPath = path.join(process.cwd(), "data", "faqs.json")
  if (!fs.existsSync(faqsPath)) return
  const faqs = JSON.parse(fs.readFileSync(faqsPath, "utf-8"))
  if (!Array.isArray(faqs) || faqs.length === 0) return

  // Delete existing first
  await supabase.from("faqs").delete().neq("id", "")

  const rows = faqs.map((f: Record<string, unknown>, i: number) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    sort_order: i,
  }))

  const { error } = await supabase.from("faqs").insert(rows)
  if (error) throw new Error(`FAQs seed failed: ${error.message}`)
  console.log(`✅ ${rows.length} FAQ(s) seeded`)
}

async function seedClicks() {
  const clicksPath = path.join(process.cwd(), "data", "clicks.json")
  if (!fs.existsSync(clicksPath)) return
  const clicks = JSON.parse(fs.readFileSync(clicksPath, "utf-8"))
  if (!Array.isArray(clicks) || clicks.length === 0) return

  const rows = clicks.map((c: Record<string, unknown>) => ({
    text: c.text,
    href: c.href,
    page_path: c.pagePath,
    referrer: c.referrer,
    timestamp: c.timestamp,
    user_agent: c.userAgent,
    ip: c.ip,
  }))

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase.from("clicks").insert(batch)
    if (error) throw new Error(`Clicks seed failed at batch ${i}: ${error.message}`)
  }
  console.log(`✅ ${rows.length} click(s) seeded`)
}

async function seedFinance() {
  const financePath = path.join(process.cwd(), "data", "finance.json")
  if (!fs.existsSync(financePath)) return
  const raw = JSON.parse(fs.readFileSync(financePath, "utf-8"))

  // Seed transactions
  const transactions = raw.transactions || []
  if (transactions.length > 0) {
    const rows = transactions.map((t: Record<string, unknown>) => ({
      id: t.id,
      type: t.type,
      category: t.category,
      subcategory: t.subcategory || "",
      amount: t.amount,
      tax: t.tax || 0,
      description: t.description,
      date: t.date,
      lead_id: t.leadId || "",
      account: t.account || "",
      recurring: t.recurring,
      frequency: t.frequency || "one-time",
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    }))
    const { error } = await supabase.from("finance_transactions").upsert(rows, { onConflict: "id" })
    if (error) throw new Error(`Finance transactions seed failed: ${error.message}`)
    console.log(`✅ ${rows.length} finance transaction(s) seeded`)
  }

  // Seed settings
  if (raw.settings) {
    const { error } = await supabase.from("finance_settings").upsert({
      id: 1,
      currency: raw.settings.currency,
      currency_symbol: raw.settings.currencySymbol,
      fiscal_year_start: raw.settings.fiscalYearStart,
      target_mrr: raw.settings.targetMrr,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    if (error) throw new Error(`Finance settings seed failed: ${error.message}`)
    console.log("✅ Finance settings seeded")
  }
}

async function seed() {
  console.log("🌱 Seeding all data to Supabase...\n")
  try {
    await seedSettings()
    await seedLeads()
    await seedUsers()
    await seedBlog()
    await seedFaqs()
    await seedClicks()
    await seedFinance()
    console.log("\n🎉 All data seeded successfully!")
  } catch (err: unknown) {
    console.error("\n❌ Seed failed:", err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

seed()
