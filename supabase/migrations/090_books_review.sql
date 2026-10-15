-- ═══════════════════════════════════════════════════════════════════════════════
-- 090 — AI BOOKS REVIEW (MartPoint's own commercial books)
-- Each run stores the deterministic findings + computed metrics and the AI
-- narrative that explains them. The AI never does arithmetic: metrics/findings
-- are produced by lib/books-checks.ts and only narrated by lib/books-review.ts.
-- Admin-only; immutable history (one row per run).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS books_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  months INTEGER NOT NULL DEFAULT 12 CHECK (months > 0),
  model TEXT,

  -- Deterministic layer (plain code)
  metrics JSONB,       -- BooksMetrics from lib/books-checks.ts
  findings JSONB,      -- Finding[] from lib/books-checks.ts
  health_score INTEGER,
  verdict TEXT CHECK (verdict IN ('HEALTHY','WATCH','ATTENTION')),

  -- AI narrative layer
  narrative JSONB,

  error_message TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS books_reviews_created_idx ON books_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS books_reviews_status_idx ON books_reviews (status);

ALTER TABLE books_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_books_reviews_all" ON books_reviews;
CREATE POLICY "sr_books_reviews_all" ON books_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
