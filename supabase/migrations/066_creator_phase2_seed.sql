-- ============================================================
-- Phase 2 seed: Learning Centre lessons, onboarding assessment,
-- creator FAQs, business-type guides, KB links.
-- All content is CMS-managed and editable in Admin → Creator
-- Network → Learning Centre. Copy is intentionally minimal and
-- safe — approved Creator Kit copy replaces it later.
-- Idempotent: keyed on slugs/unique refs, safe to re-run.
-- ============================================================

-- ── Onboarding lesson sequence (orders 3–10; 1–2 seeded in 064) ──
INSERT INTO creator_learning_content (
  title, slug, type, category, description, body,
  required, is_onboarding_step, onboarding_order, sort_order, status
)
SELECT * FROM (VALUES
  (
    'Who Uses MartPoint?',
    'who-uses-martpoint',
    'ARTICLE', 'MARTPOINT_101',
    'The kinds of Nigerian businesses that run on MartPoint.',
    E'MartPoint is used by retail shops, supermarkets, pharmacies, fashion stores, restaurants and many other business types across Nigeria.\n\nAs a creator you do not need to know every business type in depth — pick the ones your audience runs, then study their business-type guide in the Creator portal before making content.',
    true, true, 3, 20, 'PUBLISHED'
  ),
  (
    'How MartPoint Helps Businesses',
    'how-martpoint-helps-businesses',
    'ARTICLE', 'MARTPOINT_101',
    'The everyday problems MartPoint is built to solve.',
    E'Business owners come to MartPoint with everyday problems: no proper sales records, stock going missing, not knowing real profit, and paper records that get lost.\n\nWhen you create content, lead with the problem — not a feature list. Show what the owner struggles with today, then how MartPoint changes that.',
    true, true, 4, 30, 'PUBLISHED'
  ),
  (
    'Important MartPoint Features',
    'important-martpoint-features',
    'ARTICLE', 'MARTPOINT_101',
    'The features worth understanding before you create content.',
    E'You do not need to memorise every feature. Focus on the ones merchants ask about most: point of sale, inventory and stock tracking, customer records, expenses, reporting, the online store, and offline use.\n\nIf you are unsure whether a feature exists, check the Help Centre or the relevant business-type guide — never guess on camera.',
    true, true, 5, 40, 'PUBLISHED'
  ),
  (
    'MartPoint by Business Type',
    'martpoint-by-business-type',
    'ARTICLE', 'BUSINESS_TYPE',
    'Why the same product is explained differently for different businesses.',
    E'A pharmacy owner and a fashion boutique owner care about different things. MartPoint works for both — but your content lands better when it speaks their language.\n\nBefore creating content for a business type, open its Creator Guide under Guides. Each guide covers common problems, content angles, example hooks and claims to avoid.',
    true, true, 6, 50, 'PUBLISHED'
  ),
  (
    'Creating MartPoint Content',
    'creating-martpoint-content',
    'ARTICLE', 'DIGITAL_COMMERCE',
    'Structure, hooks and formats that work for MartPoint content.',
    E'Good MartPoint content is simple: hook the business owner in the first seconds, show a real problem, show the MartPoint way, then one clear call-to-action.\n\nThe Content Playbook in your Creator Kit has approved formats and checklists. Always use official screenshots and assets from the Kit — never fabricate MartPoint interfaces.',
    true, true, 7, 60, 'PUBLISHED'
  ),
  (
    'Creator Rules & Brand Guidelines',
    'creator-rules-and-brand-guidelines',
    'ARTICLE', 'GETTING_STARTED',
    'The rules every creator must follow.',
    E'The short version:\n\n1. Use official MartPoint assets from the Creator Kit.\n2. Never invent features, prices or guarantees.\n3. Be honest that joining the network does not guarantee payment — rewards come from challenge terms.\n4. Disclose the partnership where required by platform rules.\n5. Follow each challenge brief exactly.\n\nBreaking the rules can lead to content rejection or removal from the network.',
    true, true, 8, 70, 'PUBLISHED'
  ),
  (
    'How Creator Challenges Work',
    'how-creator-challenges-work',
    'ARTICLE', 'GETTING_STARTED',
    'From challenge brief to reward.',
    E'Challenges are announced in your dashboard and by notification. Each has a brief, requirements, a deadline and its own reward terms.\n\nThe flow: join a challenge → create and publish content → submit your published link → MartPoint reviews it → performance is tracked → rewards are paid per the challenge terms.\n\nOnly submit content that is publicly viewable and matches the brief.',
    true, true, 9, 80, 'PUBLISHED'
  ),
  (
    'Referrals & Conversion Tracking',
    'referrals-and-conversion-tracking',
    'ARTICLE', 'GETTING_STARTED',
    'How your tracking link works and what gets attributed.',
    E'Your referral link looks like martpoint.com.ng/?ref=MP-XXXXX. Share it in your bio and in your content.\n\nWhen someone visits MartPoint through your link and submits a lead form or books a demo within the attribution window, that lead is credited to you. Referral earnings, where offered, follow the published terms of each programme.',
    true, true, 10, 90, 'PUBLISHED'
  )
) AS l(title, slug, type, category, description, body, required, is_onboarding_step, onboarding_order, sort_order, status)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_learning_content c WHERE c.slug = l.slug
);

-- ── Onboarding assessment (final required step) ──
INSERT INTO creator_learning_content (
  title, slug, type, category, description, body,
  required, is_onboarding_step, onboarding_order, sort_order, status,
  assessment_config
)
SELECT
  'Creator Onboarding Assessment',
  'creator-onboarding-assessment',
  'ASSESSMENT', 'GETTING_STARTED',
  'A short check that you are ready to participate in Creator Challenges.',
  'Answer the questions below. You need 70% to pass. If you do not pass, review the lessons and try again.',
  true, true, 11, 100, 'PUBLISHED',
  '{"passingScore":70,"maxAttempts":3,"showIncorrect":true}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM creator_learning_content c WHERE c.slug = 'creator-onboarding-assessment'
);

INSERT INTO creator_assessment_questions (
  content_id, question, type, options, correct_keys, sort_order, feedback
)
SELECT a.id, q.question, q.type, q.options::jsonb, q.correct_keys::text[], q.sort_order, q.feedback
FROM creator_learning_content a
CROSS JOIN (VALUES
  (
    'What should you use when showing the MartPoint product in your content?',
    'SINGLE',
    '[{"key":"a","text":"Screenshots I design myself to look like MartPoint"},{"key":"b","text":"Official screenshots and assets from the Creator Kit"},{"key":"c","text":"Any app screenshot that looks similar"}]',
    '{b}', 1,
    'Always use official assets from the Creator Kit — never fabricate the interface.'
  ),
  (
    'Joining the Creator Network guarantees monthly payment.',
    'TRUE_FALSE',
    '[]',
    '{false}', 2,
    'Joining does not guarantee payment — earnings come from challenge rewards and referral programmes under published terms.'
  ),
  (
    'Which of these should lead your content?',
    'SINGLE',
    '[{"key":"a","text":"A full feature list"},{"key":"b","text":"A real problem the business owner faces"},{"key":"c","text":"How much MartPoint costs"}]',
    '{b}', 3,
    'Lead with the business problem, not the feature list.'
  ),
  (
    'Select all that apply before submitting challenge content:',
    'MULTI',
    '[{"key":"a","text":"The content follows the challenge brief"},{"key":"b","text":"The link is publicly viewable"},{"key":"c","text":"I used approved MartPoint assets"},{"key":"d","text":"I promised merchants guaranteed profit"}]',
    '{a,b,c}', 4,
    'Submissions must follow the brief, be publicly viewable and use approved assets. Never promise guaranteed profit.'
  ),
  (
    'Who makes the final decision on your content submission?',
    'SINGLE',
    '[{"key":"a","text":"An automated system"},{"key":"b","text":"The MartPoint review team"},{"key":"c","text":"Other creators"}]',
    '{b}', 5,
    'All submissions are reviewed by the MartPoint team.'
  )
) AS q(question, type, options, correct_keys, sort_order, feedback)
WHERE a.slug = 'creator-onboarding-assessment'
  AND NOT EXISTS (
    SELECT 1 FROM creator_assessment_questions e
    WHERE e.content_id = a.id AND e.sort_order = q.sort_order
  );

-- ── Creator FAQs ──
INSERT INTO creator_faqs (question, answer, category, sort_order, status)
SELECT * FROM (VALUES
  (
    'How do I join the MartPoint Creator Network?',
    'Apply at martpoint.com.ng/creators. Your application is reviewed by the MartPoint team — AI may assist with screening, but a person makes the final decision.',
    'APPLICATIONS', 0, 'PUBLISHED'
  ),
  (
    'Do I get paid just for joining?',
    'No. Joining the network does not guarantee payment. Earnings come only from challenge rewards and any referral programmes explicitly offered under published terms.',
    'PAYMENTS', 10, 'PUBLISHED'
  ),
  (
    'What is my referral link and how does it work?',
    'Approved creators get a link like martpoint.com.ng/?ref=MP-XXXXX. Leads and demo bookings that arrive through it within the attribution window are credited to you.',
    'REFERRALS', 20, 'PUBLISHED'
  ),
  (
    'How do I finish onboarding?',
    'Open Learn MartPoint in your portal, complete all required lessons, then pass the Creator Onboarding Assessment with 70% or more.',
    'LEARNING', 30, 'PUBLISHED'
  ),
  (
    'Where do I get official MartPoint screenshots and logos?',
    'Everything approved for use is in Creator Kit in your portal. Do not recreate the MartPoint interface yourself — always use the official assets.',
    'CONTENT', 40, 'PUBLISHED'
  ),
  (
    'How are challenge submissions reviewed?',
    'A member of the MartPoint team reviews every submission against the challenge brief. You will get a notification with the decision.',
    'CHALLENGES', 50, 'PUBLISHED'
  )
) AS f(question, answer, category, sort_order, status)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_faqs x WHERE x.question = f.question
);

-- ── Business-type guides (starter set — admin edits/expands) ──
INSERT INTO creator_business_guides (
  industry_slug, title, overview, common_problems, how_helps,
  features, content_angles, hooks, use_cases, claims_to_avoid,
  recommended_cta, related_links, status, sort_order
)
SELECT * FROM (VALUES
  (
    'supermarkets',
    'Supermarket Creator Guide',
    'Supermarkets handle high transaction volume, hundreds of SKUs and thin margins. Owners need speed at checkout and control over stock.',
    '["Long queues at checkout", "Stock running out without notice", "No clear picture of daily profit", "Theft and shrinkage they cannot trace", "Paper records that slow everything down"]',
    'MartPoint gives supermarket owners a fast POS, live inventory counts, and daily reports they can check from anywhere — including offline.',
    '["Point of sale", "Inventory and stock alerts", "Reports and analytics", "Multi-staff access", "Offline mode"]',
    '["Day-in-the-life of a supermarket owner", "The hidden cost of paper records", "Stock-count before and after"]',
    '["How does this supermarket know exactly what sold today?", "Your shelves are empty and you did not even notice.", "POV: you finally see your real profit for the week."]',
    '["A busy evening rush handled fast at checkout", "Owner checks yesterday''s sales from home on their phone", "Low-stock alert prevents a weekend stockout"]',
    '["Never claim MartPoint guarantees profit or eliminates theft entirely", "Do not invent features — check the Help Centre first", "Do not share made-up pricing"]',
    'Try MartPoint free — link in bio.',
    '[{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 0
  ),
  (
    'fashion-stores',
    'Fashion Store Creator Guide',
    'Fashion stores deal with sizes, colours and styles — variants make stock tracking painful, and trends move fast.',
    '["Variants (size/colour) impossible to track on paper", "Not knowing which styles actually sell", "Inventory spread across shop and online", "Seasonal dead stock"]',
    'MartPoint tracks every variant of every item, shows what sells fastest, and keeps the shop and online store in sync.',
    '["Product variants", "Inventory tracking", "Online store", "Sales reports"]',
    '["Boutique owner POV", "The variant nightmare on paper vs on MartPoint", "Selling in-store and online at once"]',
    '["You have three sizes left of that dress — do you know which?", "Your shop is closed but your store is not.", "POV: every sale updates your stock automatically."]',
    '["Customer buys a dress in-store; online stock updates instantly", "Owner reorders the style that is actually selling, not guessing"]',
    '["Never claim a feature that is not on martpoint.com.ng", "Do not promise specific sales increases"]',
    'Try MartPoint free — link in bio.',
    '[{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 10
  )
) AS g(industry_slug, title, overview, common_problems, how_helps, features, content_angles, hooks, use_cases, claims_to_avoid, recommended_cta, related_links, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_business_guides x WHERE x.industry_slug = g.industry_slug
);

-- ── KB links (admin-managed; point at public help surfaces) ──
INSERT INTO creator_kb_links (title, description, url, category, sort_order, active)
SELECT * FROM (VALUES
  ('MartPoint Help Centre', 'Public help articles for MartPoint features.', '/help-centre', 'General', 0, true),
  ('MartPoint FAQs', 'Common questions about the MartPoint platform.', '/faqs', 'General', 10, true),
  ('Contact Support', 'Reach the MartPoint team when a question is not covered.', '/support', 'Support', 20, true)
) AS k(title, description, url, category, sort_order, active)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_kb_links x WHERE x.url = k.url
);
