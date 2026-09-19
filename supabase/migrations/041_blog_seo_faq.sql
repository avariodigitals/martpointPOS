-- Split keywords into primary/secondary and add optional per-post FAQs
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS primary_keywords TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS secondary_keywords TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS faqs JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill primary keywords from the legacy keywords column
UPDATE blog_posts SET primary_keywords = keywords WHERE primary_keywords IS NULL AND keywords IS NOT NULL;
