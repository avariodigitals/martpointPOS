-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  category TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_description TEXT,
  keywords TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clicks / tracking
CREATE TABLE IF NOT EXISTS clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT,
  href TEXT,
  page_path TEXT,
  referrer TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip TEXT
);

-- Users (admin auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Finance transactions
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  amount INTEGER NOT NULL,
  tax INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  lead_id TEXT,
  account TEXT,
  recurring BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'one-time',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Finance settings
CREATE TABLE IF NOT EXISTS finance_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  currency TEXT DEFAULT 'NGN',
  currency_symbol TEXT DEFAULT '₦',
  fiscal_year_start TEXT DEFAULT '2026-01-01',
  target_mrr INTEGER DEFAULT 1000000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;

-- Service role full access on all tables
CREATE POLICY "sr_blog_posts" ON blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sr_clicks" ON clicks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sr_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sr_faqs" ON faqs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sr_finance_txn" ON finance_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sr_finance_settings" ON finance_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public to insert clicks
CREATE POLICY "anon_clicks_insert" ON clicks FOR INSERT TO anon WITH CHECK (true);

-- Allow public to read published blog posts and FAQs
CREATE POLICY "anon_blog_read" ON blog_posts FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "anon_faqs_read" ON faqs FOR SELECT TO anon USING (true);
