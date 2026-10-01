-- ============================================================
-- Phase 2b: Creator Kit documents — inline bodies + PDF flag.
-- ARTICLE-type resources gain a CMS body (simple markup consumed
-- by lib/creator-doc-pdf.ts) and pdf_enabled so the same managed
-- content powers "View Online" and "Download PDF".
-- Idempotent: ALTERs are IF NOT EXISTS; seeds keyed on name.
-- ============================================================

ALTER TABLE creator_resources
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS pdf_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── Initial Creator Kit documents (skeleton copy — approved final
--    text is edited in Admin → Creator Kit without code changes) ──
INSERT INTO creator_resources (
  name, description, category, resource_type, body, pdf_enabled,
  version, usage_notes, active, sort_order
)
SELECT * FROM (VALUES
  (
    'MartPoint Creator Quick Guide',
    'The one-page essentials: what the network is, how rewards work, and the rules that matter most.',
    'GETTING_STARTED', 'ARTICLE',
    E'# Getting Started\n\nWelcome to the MartPoint Creator Network. This quick guide covers the essentials — see the full Content & Brand Guide and Creator Playbook for detail.\n\n## How it works\n\n- Apply and get approved.\n- Complete onboarding in the Learning Centre.\n- Join challenges and create content.\n- Submit your published links for review.\n- Earn rewards per each challenge''s published terms.\n\n> Joining the network does not guarantee payment. Earnings come only from challenge rewards and any referral programmes explicitly offered under published terms.\n\n## Your tools\n\n- Dashboard — your progress, challenges and performance.\n- Learn MartPoint — lessons and the onboarding assessment.\n- Creator Kit — approved logos, screenshots, videos and templates.\n- Guides — business-type playbooks for your audience.\n\n## The rules that matter\n\n- Always use official MartPoint assets from the Creator Kit.\n- Never invent features, prices or guarantees.\n- Disclose the partnership where the platform requires it.\n- Follow each challenge brief exactly.\n\n## Need help?\n\nOpen the Knowledge Base or FAQ in your portal, or reach the MartPoint team via the contact details in the footer of this document.',
    true, 'v0.1',
    'Skeleton draft — replace with approved copy before wide distribution.',
    true, 0
  ),
  (
    'MartPoint Content & Brand Guide',
    'How to talk about MartPoint, use brand assets correctly, and stay inside the rules.',
    'BRAND_ASSETS', 'ARTICLE',
    E'# Brand Essentials\n\nThis guide defines how creators represent MartPoint in public content.\n\n## Voice\n\n- Plain, direct language a shop owner understands.\n- Lead with the business problem, not the feature list.\n- Honest — never exaggerate results.\n\n## Brand assets\n\n- Use only logos, screenshots and videos from the Creator Kit.\n- Do not redraw, stretch or recolour the logo.\n- Do not fabricate the MartPoint interface — capture or use official screens.\n\n## Accuracy\n\n- Only describe features that exist on martpoint.com.ng.\n- Check the Help Centre when unsure.\n- Never promise specific earnings, savings or outcomes.\n\n## Disclosures\n\n- Disclose that you are a MartPoint creator where the platform requires it.\n- Make it clear rewards depend on challenge terms.\n\n# Claims to Avoid\n\n- Guaranteed profit or sales increases.\n- Features or pricing that are not published.\n- Implying MartPoint employment or partnership beyond the Creator Network.\n\n> When in doubt, ask the MartPoint team before publishing.',
    true, 'v0.1',
    'Skeleton draft — replace with approved copy before wide distribution.',
    true, 10
  ),
  (
    'MartPoint Creator Playbook',
    'Content structures, hooks and formats for creator content across supported business types.',
    'CONTENT_PLAYBOOK', 'ARTICLE',
    E'# The Playbook\n\nProven content structures for MartPoint creator content. Pair this with the business-type guides in your portal.\n\n## Core structure\n\n1. Hook — a problem the business owner feels in the first seconds.\n2. Show the problem — a real, relatable scenario.\n3. Show the MartPoint way — official screens and assets.\n4. One clear call-to-action.\n\n## Formats that work\n\n- POV and day-in-the-life.\n- Before/after on paper records vs MartPoint.\n- Shop-visit and owner-interview formats.\n- Feature walkthroughs with official screenshots.\n\n## Before you publish\n\n- Follows the challenge brief exactly.\n- Uses approved assets only.\n- Link is publicly viewable.\n- CTA points to martpoint.com.ng or your referral link.\n\n> Submissions that invent features, misquote pricing or promise guaranteed results are rejected.',
    true, 'v0.1',
    'Skeleton draft — replace with approved copy before wide distribution.',
    true, 20
  )
) AS r(name, description, category, resource_type, body, pdf_enabled, version, usage_notes, active, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_resources x WHERE x.name = r.name
);
