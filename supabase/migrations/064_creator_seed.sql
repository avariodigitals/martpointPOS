-- Seed: Creator Network — realistic test applications + default module settings.
-- References use an MCA-SEED-* prefix so they never collide with the
-- MCA-<year>-<seq> sequence used by live submissions. All rows are idempotent.

-- Module defaults inside the shared settings document (merged, not replaced).
UPDATE settings
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{creator}',
  COALESCE(data->'creator', '{}'::jsonb) || '{
    "applicationsOpen": true,
    "autoAiReview": true,
    "requireOnboardingBeforeSubmissions": true,
    "minimumAge": 18
  }'::jsonb,
  true
),
updated_at = now()
WHERE id = 1;

-- ───────────────────────────  Sample applications  ───────────────────────────

INSERT INTO creator_applications (
  reference_number, full_name, email, phone, whatsapp,
  country, state, city, date_of_birth, age_confirmed,
  primary_category, secondary_category, languages, bio, experience_years,
  primary_audience, audience_locations, audience_age_range,
  audience_has_business_owners, audience_industries,
  portfolio_links, why_creator, introduce_martpoint,
  consents, consent_version, consented_at,
  status, status_history, submitted_at
)
SELECT * FROM (VALUES
  (
    'MCA-SEED-001', 'Adaeze Okafor', 'adaeze.okafor.demo@example.com',
    '08031234567', '08031234567', 'Nigeria', 'Lagos', 'Ikeja',
    '1998-04-12'::date, true,
    'Business / Entrepreneurship', 'Finance', ARRAY['English','Igbo','Pidgin'],
    'Small-business content creator documenting how Nigerian SMEs run their shops. I break down POS, pricing and stock control in plain language.',
    '3-5',
    'Small business owners and market traders', ARRAY['Lagos','Anambra','Enugu'], '25-44',
    true, ARRAY['Retail','Fashion','Food'],
    '[
      {"url":"https://tiktok.com/@adaezebiz/video/seed1","note":"How I organise my shop till"},
      {"url":"https://instagram.com/p/seed2","note":"Pricing mistakes small shops make"},
      {"url":"https://youtube.com/watch?v=seed3","note":"Day in the life of a mini-mart owner"}
    ]'::jsonb,
    'I have spent three years helping traders digitise their shops. MartPoint solves exactly the problems my audience asks about every week — stockouts, missing money and no sales records.',
    'I would film a real shop owner switching from a paper ledger to MartPoint and show the moment they see their actual profit for the first time.',
    '{"accurate":true,"publicContentReview":true,"networkRules":true,"noGuarantee":true}'::jsonb,
    'creator-network-v1', now() - interval '9 days',
    'SUBMITTED',
    '[{"status":"SUBMITTED","at":"seeded"}]'::jsonb,
    now() - interval '9 days'
  ),
  (
    'MCA-SEED-002', 'Tunde Balogun', 'tunde.balogun.demo@example.com',
    '08052345678', NULL, 'Nigeria', 'Abuja', 'Wuse 2',
    '1995-11-02'::date, true,
    'Technology', 'Education', ARRAY['English','Yoruba'],
    'Tech explainer for Nigerian businesses. I review software tools and show owners what actually works in our market.',
    '5+',
    'Tech-curious business owners, 25-40', ARRAY['Abuja','Lagos','Port Harcourt'], '22-40',
    true, ARRAY['Technology','Retail','Services'],
    '[
      {"url":"https://youtube.com/watch?v=seed4","note":"POS systems compared"},
      {"url":"https://youtube.com/watch?v=seed5","note":"Inventory apps for SMEs"}
    ]'::jsonb,
    'MartPoint is one of the few platforms built for how Nigerian shops actually operate — offline support, WhatsApp ordering, multi-branch. That story tells itself on camera.',
    'A short explainer series: "Your shop in your pocket" — showing owners checking sales from their phone while away from the store.',
    '{"accurate":true,"publicContentReview":true,"networkRules":true,"noGuarantee":true}'::jsonb,
    'creator-network-v1', now() - interval '6 days',
    'AI_REVIEWED',
    '[{"status":"SUBMITTED","at":"seeded"},{"status":"AI_REVIEWED","at":"seeded"}]'::jsonb,
    now() - interval '6 days'
  ),
  (
    'MCA-SEED-003', 'Fatima Abubakar', 'fatima.abubakar.demo@example.com',
    '07063456789', '07063456789', 'Nigeria', 'Kano', 'Nassarawa',
    '2000-01-20'::date, true,
    'Lifestyle', 'Food', ARRAY['Hausa','English','Pidgin'],
    'Hausa-language lifestyle and small-business creator covering market life in Kano.',
    '1-2',
    'Hausa-speaking traders and homemakers', ARRAY['Kano','Kaduna','Zaria'], '18-35',
    true, ARRAY['Food','Fashion','Retail'],
    '[
      {"url":"https://tiktok.com/@fatimakano/video/seed6","note":"Market day vlog"},
      {"url":"https://instagram.com/p/seed7","note":"Shop setup tips"}
    ]'::jsonb,
    'Most business software content is in English only. My audience trusts Hausa explanations — I can take MartPoint to traders other creators cannot reach.',
    'A Hausa-language video inside a real provision store: "Yadda za ka san ribaka" — how to know your real profit.',
    '{"accurate":true,"publicContentReview":true,"networkRules":true,"noGuarantee":true}'::jsonb,
    'creator-network-v1', now() - interval '4 days',
    'MANUAL_REVIEW',
    '[{"status":"SUBMITTED","at":"seeded"},{"status":"MANUAL_REVIEW","at":"seeded","by":"Admin"}]'::jsonb,
    now() - interval '4 days'
  ),
  (
    'MCA-SEED-004', 'Chidi Nwosu', 'chidi.nwosu.demo@example.com',
    '08074567890', NULL, 'Nigeria', 'Rivers', 'Port Harcourt',
    '1999-07-08'::date, true,
    'Entertainment', 'Lifestyle', ARRAY['English','Pidgin'],
    'Comedy skits built around everyday Nigerian business struggles.',
    '3-5',
    'General entertainment audience, 18-30', ARRAY['Rivers','Lagos','Delta'], '18-30',
    false, ARRAY['Entertainment','Food'],
    '[
      {"url":"https://tiktok.com/@chidiskits/video/seed8","note":"Shopkeeper skit"},
      {"url":"https://tiktok.com/@chidiskits/video/seed9","note":"Customer is always right skit"}
    ]'::jsonb,
    'My comedy already features shop owners — MartPoint challenges fit naturally into what I make.',
    'A skit where the shop owner keeps losing money until MartPoint shows him exactly where it went.',
    '{"accurate":true,"publicContentReview":true,"networkRules":true,"noGuarantee":true}'::jsonb,
    'creator-network-v1', now() - interval '2 days',
    'WAITLISTED',
    '[{"status":"SUBMITTED","at":"seeded"},{"status":"WAITLISTED","at":"seeded","by":"Admin","reason":"Audience skews young; revisit after next challenge brief."}]'::jsonb,
    now() - interval '2 days'
  ),
  (
    'MCA-SEED-005', 'Blessing Eze', 'blessing.eze.demo@example.com',
    '08185678901', '08185678901', 'Nigeria', 'Enugu', 'Enugu',
    '1997-03-15'::date, true,
    'Education', 'Business / Entrepreneurship', ARRAY['English','Igbo'],
    'I teach bookkeeping basics to market women and run a weekly know-your-numbers series.',
    '5+',
    'Market traders, mostly women 30-55', ARRAY['Enugu','Anambra','Ebonyi'], '30-55',
    true, ARRAY['Retail','Fashion','Food'],
    '[
      {"url":"https://facebook.com/blessingnumbers/posts/seed10","note":"Know your numbers ep. 12"},
      {"url":"https://youtube.com/watch?v=seed11","note":"Bookkeeping without a laptop"}
    ]'::jsonb,
    'I already teach the concepts MartPoint automates. Showing traders the software version of my lessons is a natural fit.',
    'A side-by-side: the notebook method versus MartPoint — same shop, same day, one takes an hour and one takes seconds.',
    '{"accurate":true,"publicContentReview":true,"networkRules":true,"noGuarantee":true}'::jsonb,
    'creator-network-v1', now() - interval '1 day',
    'REJECTED',
    '[{"status":"SUBMITTED","at":"seeded"},{"status":"REJECTED","at":"seeded","by":"Admin","reason":"Duplicate of an earlier application from the same profile."}]'::jsonb,
    now() - interval '1 day'
  )
) AS seed(
  reference_number, full_name, email, phone, whatsapp,
  country, state, city, date_of_birth, age_confirmed,
  primary_category, secondary_category, languages, bio, experience_years,
  primary_audience, audience_locations, audience_age_range,
  audience_has_business_owners, audience_industries,
  portfolio_links, why_creator, introduce_martpoint,
  consents, consent_version, consented_at,
  status, status_history, submitted_at
)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_applications a WHERE a.reference_number = seed.reference_number
);

-- Social profiles for the seeded applications.
INSERT INTO creator_social_profiles (
  application_id, platform, profile_url, username,
  followers, typical_views, typical_engagement, is_primary
)
SELECT a.id, s.platform, s.profile_url, s.username,
       s.followers, s.typical_views, s.engagement, s.is_primary
FROM creator_applications a
JOIN (VALUES
  ('MCA-SEED-001','TIKTOK','https://tiktok.com/@adaezebiz','@adaezebiz',48000,12000,'6.5% likes',true),
  ('MCA-SEED-001','INSTAGRAM','https://instagram.com/adaezebiz','@adaezebiz',21000,8000,'4.1% likes',false),
  ('MCA-SEED-001','YOUTUBE','https://youtube.com/@adaezebiz','@adaezebiz',9500,3000,NULL,false),
  ('MCA-SEED-002','YOUTUBE','https://youtube.com/@tundetech','@tundetech',62000,18000,'5.2% likes',true),
  ('MCA-SEED-003','TIKTOK','https://tiktok.com/@fatimakano','@fatimakano',33000,25000,'8.9% likes',true),
  ('MCA-SEED-003','INSTAGRAM','https://instagram.com/fatimakano','@fatimakano',11000,6000,NULL,false),
  ('MCA-SEED-004','TIKTOK','https://tiktok.com/@chidiskits','@chidiskits',154000,210000,'11.2% likes',true),
  ('MCA-SEED-005','FACEBOOK','https://facebook.com/blessingnumbers','Blessing Eze',27000,9000,'7.4% likes',true),
  ('MCA-SEED-005','YOUTUBE','https://youtube.com/@blessingnumbers','@blessingnumbers',8300,2400,NULL,false)
) AS s(ref, platform, profile_url, username, followers, typical_views, engagement, is_primary)
  ON a.reference_number = s.ref
WHERE NOT EXISTS (
  SELECT 1 FROM creator_social_profiles p
  WHERE p.application_id = a.id AND p.profile_url = s.profile_url
);

-- A published onboarding learning item so the creator portal is not empty on staging.
INSERT INTO creator_learning_content (
  title, slug, type, category, description, body,
  required, is_onboarding_step, onboarding_order, sort_order, status
)
SELECT * FROM (VALUES
  (
    'Welcome to the MartPoint Creator Network',
    'welcome-to-the-creator-network',
    'ARTICLE', 'MARTPOINT_101',
    'What the Creator Network is, how it works and what is expected of you.',
    E'Welcome aboard.\n\nThe MartPoint Creator Network helps Nigerian businesses discover smarter ways to run their operations — through creators they already trust.\n\nWhat happens next:\n1. Complete the onboarding lessons.\n2. Download the Creator Kit.\n3. Join a challenge and publish content.\n4. Submit your published links for review.\n\nRemember: never promise merchants guaranteed earnings or features that are not on martpoint.com.ng.',
    true, true, 1, 0, 'PUBLISHED'
  ),
  (
    'What is MartPoint?',
    'what-is-martpoint',
    'ARTICLE', 'MARTPOINT_101',
    'The two-minute version of what MartPoint does for a shop owner.',
    E'MartPoint is a retail operating system: POS, inventory, online store, expenses, staff and reporting in one place — built for African businesses and works offline.\n\nWhen you talk about MartPoint, lead with the business problem (missing stock, no sales records, blind profit), not the feature list.',
    true, true, 2, 10, 'PUBLISHED'
  )
) AS l(title, slug, type, category, description, body, required, is_onboarding_step, onboarding_order, sort_order, status)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_learning_content c WHERE c.slug = l.slug
);
