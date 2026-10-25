-- Creator-safe content pack.
--
-- This migration publishes only plain-language material intended for creators.
-- Internal routes, credentials, database details, infrastructure notes, audit
-- reports and admin instructions are deliberately excluded from the pack.
-- The two PDF files are static Next.js public assets:
--   /creator-resources/martpoint-creator-content-and-business-guide.pdf
--   /creator-resources/martpoint-creator-challenge-and-tracking-guide.pdf

-- Retire the original skeleton articles so creators see the finished PDF pack
-- as the authoritative version instead of two competing drafts.
UPDATE creator_resources
SET active = false,
    usage_notes = 'Replaced by the approved creator-safe PDF content pack.'
WHERE name IN (
  'MartPoint Creator Quick Guide',
  'MartPoint Content & Brand Guide',
  'MartPoint Creator Playbook'
);

INSERT INTO creator_resources (
  name, description, category, resource_type, external_url, version,
  usage_notes, active, sort_order, published_at
)
SELECT * FROM (VALUES
  (
    'Creator Content & Business Guide',
    'Approved language, business-type angles, content structures and a pre-publish checklist.',
    'CONTENT_GUIDELINES', 'FILE',
    '/creator-resources/martpoint-creator-content-and-business-guide.pdf',
    '1.0',
    'Use this as the public content and business reference. Challenge-specific rules always take priority.',
    true, 5, now()
  ),
  (
    'Creator Challenge & Tracking Guide',
    'How challenge links, submissions, evidence and award categories work in plain language.',
    'CHALLENGE_RESOURCES', 'FILE',
    '/creator-resources/martpoint-creator-challenge-and-tracking-guide.pdf',
    '1.0',
    'Use this alongside the exact challenge page. The challenge page controls dates, thresholds, prizes and required wording.',
    true, 15, now()
  )
) AS r(name, description, category, resource_type, external_url, version, usage_notes, active, sort_order, published_at)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_resources x WHERE x.name = r.name
);

INSERT INTO creator_learning_content (
  title, slug, type, category, description, body, external_url,
  required, is_onboarding_step, sort_order, status, published_at,
  related_links
)
SELECT * FROM (VALUES
  (
    'Creator Content & Business Guide',
    'creator-content-and-business-guide',
    'DOWNLOAD', 'DIGITAL_COMMERCE',
    'Download the approved guide for explaining MartPoint clearly across different business types.',
    'Use this guide for approved content angles, safe language, business-type examples and the final publishing checklist.',
    '/creator-resources/martpoint-creator-content-and-business-guide.pdf',
    false, false, 205, 'PUBLISHED', now(),
    '[{"label":"Open Creator Kit","url":"/creator/kit"}]'::jsonb
  ),
  (
    'Creator Challenge & Tracking Guide',
    'creator-challenge-and-tracking-guide',
    'DOWNLOAD', 'GETTING_STARTED',
    'Download the plain-language guide to joining challenges, using your link and submitting evidence.',
    'Use this guide to understand the challenge journey. Always follow the exact challenge page for current dates, prizes and requirements.',
    '/creator-resources/martpoint-creator-challenge-and-tracking-guide.pdf',
    false, false, 215, 'PUBLISHED', now(),
    '[{"label":"View Challenges","url":"/creator/challenges"}]'::jsonb
  ),
  (
    'Safe Claims & Brand Language',
    'safe-claims-and-brand-language',
    'ARTICLE', 'CONTENT_GUIDELINES',
    'A quick reference for honest, accurate MartPoint creator content.',
    E'Use language that is accurate and easy for a business owner to understand.\n\n- Say that MartPoint can help a business track, organise, review, record or understand its operations.\n- Use only features, prices and results that appear in current approved MartPoint material.\n- Do not promise guaranteed profit, guaranteed sales, zero theft, zero errors or instant results.\n- Do not show customer personal data, staff passwords, private business figures or internal screens.\n- If a claim is unclear, ask the MartPoint team before publishing.',
    null,
    false, false, 225, 'PUBLISHED', now(),
    '[{"label":"Open Creator Kit","url":"/creator/kit"}]'::jsonb
  )
) AS l(title, slug, type, category, description, body, external_url, required, is_onboarding_step, sort_order, status, published_at, related_links)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_learning_content x WHERE x.slug = l.slug
);

INSERT INTO creator_faqs (question, answer, category, sort_order, status)
SELECT * FROM (VALUES
  (
    'How do I join a Creator Challenge?',
    'Open the challenge page in your Creator Portal, read the brief and published requirements, then select Join Challenge before the closing time. If you are already an approved creator, you can join from the challenge list without applying again.',
    'CHALLENGES', 60, 'PUBLISHED'
  ),
  (
    'Where do I get my creator tracking link?',
    'Your approved creator dashboard provides your creator link. A challenge may also provide a submission-specific link. Use the exact link shown for the activity and place it only where the platform and challenge brief permit.',
    'REFERRALS', 70, 'PUBLISHED'
  ),
  (
    'Do views or clicks automatically win a challenge?',
    'No. Views and clicks are only one part of performance. The published challenge category may focus on qualified enquiries, conversions, verified reach, creative quality or another clearly stated measure. Raw traffic alone is not a qualified conversion.',
    'REWARDS', 80, 'PUBLISHED'
  ),
  (
    'What makes a conversion qualified?',
    'A qualified conversion is an outcome that matches the challenge or referral terms, such as a genuine enquiry, demo request or other published action. Duplicate, self-referred, misleading or unverifiable activity may not qualify.',
    'REFERRALS', 90, 'PUBLISHED'
  ),
  (
    'Can I use my own MartPoint screenshots or redesign the app screen?',
    'Use approved screenshots, logos, videos and product descriptions from Creator Kit. Do not recreate the interface or imply that an unapproved screen is a current MartPoint feature.',
    'CONTENT', 100, 'PUBLISHED'
  ),
  (
    'What should I do if I need to correct a submitted post?',
    'Follow the feedback in your portal notification, update the public post where possible and submit the corrected public URL before the challenge deadline. The challenge rules still apply after a correction request.',
    'SUBMISSIONS', 110, 'PUBLISHED'
  ),
  (
    'How are the three winner categories decided?',
    'The challenge page states the active categories and their measures. Depending on the challenge, these may include overall performance, qualified conversions or reach, and creative quality. Winners are selected using the published measure and any required verification; high views alone do not decide every category.',
    'REWARDS', 120, 'PUBLISHED'
  ),
  (
    'What happens if a challenge is paused or withdrawn?',
    'The challenge page or portal notification will explain what happens next. Keep your existing records and published content unless MartPoint asks you to remove or change it. Any revised dates, requirements or award terms will be shown in the challenge notice.',
    'CHALLENGES', 130, 'PUBLISHED'
  ),
  (
    'What information must never appear in my content?',
    'Never show customer personal information, passwords, private sales figures, internal dashboards, private links or confidential business records. Use only public or approved Creator Kit material.',
    'CONTENT', 140, 'PUBLISHED'
  ),
  (
    'Can I promise a business owner guaranteed results?',
    'No. Do not promise guaranteed profit, sales, savings, zero errors or instant growth. Explain the practical problem MartPoint can help them organise and invite them to learn more through the approved call to action.',
    'RULES', 150, 'PUBLISHED'
  )
) AS f(question, answer, category, sort_order, status)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_faqs x WHERE x.question = f.question
);

INSERT INTO creator_business_guides (
  industry_slug, title, overview, common_problems, how_helps,
  features, content_angles, hooks, use_cases, claims_to_avoid,
  recommended_cta, related_links, status, sort_order
)
SELECT * FROM (VALUES
  (
    'restaurants',
    'Restaurant & Food Creator Guide',
    'Restaurants need a clear view of orders, products, expenses and daily sales while service is moving quickly.',
    '{"Order mistakes", "Unclear daily sales", "Food and stock waste", "Difficult end-of-day reviews"}'::text[],
    'Show how a clearer record can help the owner review orders, stock and daily activity in one place.',
    '{"Point of sale", "Inventory tracking", "Expenses", "Sales reports"}'::text[],
    '{"A busy service from order to end-of-day review", "The cost of guessing food stock", "A cleaner daily sales routine"}'::text[],
    '{"What did the restaurant actually sell today?", "Busy service does not have to mean unclear records.", "POV: the owner can review the day before closing."}'::text[],
    '{"A rush-hour order is recorded clearly", "Owner reviews the day''s sales and expenses", "Stock review before the next service"}'::text[],
    '{"Do not promise fewer mistakes in every situation", "Do not claim a specific delivery or payment integration unless approved", "Do not promise guaranteed profit"}'::text[],
    'See how MartPoint can fit your business — link in bio.',
    '[{"label":"Creator Content & Business Guide","url":"/creator-resources/martpoint-creator-content-and-business-guide.pdf"},{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 20
  ),
  (
    'pharmacies',
    'Pharmacy & Health Retail Creator Guide',
    'Pharmacies need careful records, product availability and a dependable way to review sales without exposing customer information.',
    '{"Hard-to-check stock", "Product availability questions", "Paper records", "Sensitive customer information"}'::text[],
    'Keep the content focused on organised retail records and stock visibility. Never show prescriptions, patient details or private customer data.',
    '{"Point of sale", "Inventory tracking", "Customer records", "Reports"}'::text[],
    '{"Why careful records matter in health retail", "A stock review without paper confusion", "Organised retail data and customer privacy"}'::text[],
    '{"The right product should be easy to find in the record.", "Good retail content protects customer privacy.", "A clearer stock routine helps the team stay prepared."}'::text[],
    '{"Owner checks product availability", "Staff review stock without displaying customer data", "End-of-day sales review"}'::text[],
    '{"Never show patient or prescription information", "Do not make medical claims", "Do not promise a product is always available"}'::text[],
    'Learn how MartPoint supports organised retail — link in bio.',
    '[{"label":"Creator Content & Business Guide","url":"/creator-resources/martpoint-creator-content-and-business-guide.pdf"},{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 30
  ),
  (
    'electronics-stores',
    'Electronics & Gadget Store Creator Guide',
    'Electronics stores handle models, accessories, stock changes and customer follow-up after a sale.',
    '{"Many product models", "Accessory stock confusion", "Warranty follow-up", "Unclear sales history"}'::text[],
    'Show how organised product and sales records help the owner understand what sold and what needs attention next.',
    '{"Point of sale", "Inventory tracking", "Product records", "Sales reports"}'::text[],
    '{"The story of a gadget sale", "Model and accessory stock on a busy day", "What the owner needs after the customer leaves"}'::text[],
    '{"Can you find the exact model that sold?", "A gadget sale is more than the receipt.", "Know what moved before you reorder."}'::text[],
    '{"Customer purchase is recorded clearly", "Owner checks fast-moving accessories", "Sales review before a restock"}'::text[],
    '{"Do not promise warranty outcomes", "Do not show customer details or serial numbers", "Do not claim an integration unless approved"}'::text[],
    'See a clearer way to organise your store — link in bio.',
    '[{"label":"Creator Content & Business Guide","url":"/creator-resources/martpoint-creator-content-and-business-guide.pdf"},{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 40
  ),
  (
    'beauty-and-salons',
    'Beauty & Salon Creator Guide',
    'Beauty businesses combine products, services, appointments and repeat customers, so the story should be practical and easy to follow.',
    '{"Product and service records in different places", "Unclear daily sales", "Repeat-customer follow-up", "Stock not reviewed often"}'::text[],
    'Focus on the business owner''s routine: recording activity, reviewing sales and keeping product information organised.',
    '{"Point of sale", "Product records", "Customer records", "Reports"}'::text[],
    '{"A salon owner''s day in one record", "Products and services together", "A better end-of-day routine"}'::text[],
    '{"Your clients remember the service — can your records keep up?", "A clearer routine behind the chair.", "Turn a busy day into a useful review."}'::text[],
    '{"Owner reviews the day''s services and product sales", "Stock check before the weekend", "A repeat customer record without exposing private information"}'::text[],
    '{"Do not promise guaranteed repeat customers", "Do not show private client details", "Do not claim appointment features unless approved"}'::text[],
    'Find the setup that fits your business — link in bio.',
    '[{"label":"Creator Content & Business Guide","url":"/creator-resources/martpoint-creator-content-and-business-guide.pdf"},{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 50
  ),
  (
    'wholesalers',
    'Wholesale & Distribution Creator Guide',
    'Wholesalers manage multiple customers, deliveries, invoices and payment follow-up across a larger flow of goods.',
    '{"Many customer orders", "Delivery and invoice follow-up", "Stock movement", "Scattered payment records"}'::text[],
    'Show one clear journey from order to record review, without exposing private customer, supplier or payment information.',
    '{"Sales records", "Inventory tracking", "Customer records", "Reports"}'::text[],
    '{"One order from request to delivery", "The cost of scattered records", "A wholesale review before the next dispatch"}'::text[],
    '{"Can the team see what was ordered and what was delivered?", "Wholesale gets clearer when the record is together.", "Know what moved before the next dispatch."}'::text[],
    '{"Team reviews an order before dispatch", "Owner checks stock movement", "End-of-day customer and sales review"}'::text[],
    '{"Do not promise faster delivery in every case", "Do not show private invoices or customer data", "Do not claim tax or accounting outcomes unless approved"}'::text[],
    'See how MartPoint can help organise your business — link in bio.',
    '[{"label":"Creator Content & Business Guide","url":"/creator-resources/martpoint-creator-content-and-business-guide.pdf"},{"label":"MartPoint Help Centre","url":"/help-centre"}]'::jsonb,
    'PUBLISHED', 60
  )
) AS g(industry_slug, title, overview, common_problems, how_helps, features, content_angles, hooks, use_cases, claims_to_avoid, recommended_cta, related_links, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM creator_business_guides x WHERE x.industry_slug = g.industry_slug
);

-- Make the approved content guide available from every existing business guide,
-- while preserving any links an administrator has already added.
UPDATE creator_business_guides g
SET related_links = g.related_links || jsonb_build_array(
  jsonb_build_object(
    'label', 'Creator Content & Business Guide',
    'url', '/creator-resources/martpoint-creator-content-and-business-guide.pdf'
  )
)
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(g.related_links, '[]'::jsonb)) AS link_value
  WHERE link_value->>'url' = '/creator-resources/martpoint-creator-content-and-business-guide.pdf'
);
