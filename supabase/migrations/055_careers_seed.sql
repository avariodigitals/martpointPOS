-- Seed: careers lookups, settings and the first two Ilobu field vacancies.
-- Both vacancies are inserted as DRAFT — an authorised admin must publish them.

INSERT INTO career_departments (name, description, sort_order) VALUES
  ('Field Operations', 'On-ground inventory, deployment and field workforce teams.', 10),
  ('Engineering', 'Product and platform engineering.', 20),
  ('Sales', 'Commercial and revenue teams.', 30),
  ('Customer Success', 'Onboarding, support and customer outcomes.', 40),
  ('Marketing', 'Growth, content and brand.', 50),
  ('People & HR', 'Recruitment, culture and people operations.', 60)
ON CONFLICT (name) DO NOTHING;

INSERT INTO career_job_categories (name, description, sort_order) VALUES
  ('Inventory Operations', 'Inventory counting, product capture and stock data roles.', 10),
  ('Field Supervision', 'Team leads and deployment supervisors.', 20),
  ('Engineering', 'Software and platform roles.', 30),
  ('Sales & Marketing', 'Commercial and marketing roles.', 40),
  ('Customer Success', 'Support and onboarding roles.', 50)
ON CONFLICT (name) DO NOTHING;

INSERT INTO career_settings (key, value) VALUES
  ('privacy_version', '"careers-privacy-v1"'),
  ('defaults', '{"talentPoolEnabled": true, "applicationSource": "careers_page"}')
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────  Vacancy 1: Temporary Inventory Officer  ───────────────────────────

INSERT INTO career_vacancies (
  title, slug, reference_number,
  department_id, job_category_id,
  short_summary, description, responsibilities, requirements,
  openings, show_openings, featured, urgent,
  employment_type, work_arrangement,
  working_days, work_start_time, work_end_time, duration_description,
  compensation_type, compensation_min_kobo, compensation_max_kobo, currency,
  show_compensation, transport_allowance_kobo, lunch_provided, accommodation_provided,
  other_benefits,
  cv_required, cover_letter_required, equipment_fields,
  status
)
SELECT
  'Temporary Inventory Officer',
  'temporary-inventory-officer-ilobu',
  'MPV-2026-0001',
  d.id, c.id,
  'Short-term field role capturing supermarket product data in Ilobu, Osun State. Daily pay, transport allowance, lunch and water provided.',
  'MartPoint is deploying a field team to capture a complete product database for a supermarket in Ilobu, Osun State. Inventory Officers identify products on shelves, capture names, brands, categories, barcodes, pack sizes, prices and opening-stock quantities using an Android smartphone.' || E'\n\n' ||
  'Duration: 5 working days (subject to project requirements).' || E'\n' ||
  'Working hours: 8:00 AM – 5:00 PM.' || E'\n' ||
  'Minimum daily target: 80 verified products. Operational target: 100–120 verified products.' || E'\n\n' ||
  'Compensation: ₦10,000 daily plus ₦2,000 daily transport allowance. Lunch and water are provided on site.',
  ARRAY[
    'Physically identify supermarket products.',
    'Capture product names, brands and categories.',
    'Scan or enter product barcodes.',
    'Capture pack sizes, cost prices and selling prices.',
    'Capture opening-stock quantities.',
    'Capture expiry dates where applicable.',
    'Prevent incomplete or duplicate product records.',
    'Follow daily shelf or section assignments.',
    'Maintain accuracy while meeting the daily target.'
  ],
  ARRAY[
    'Lives in Ilobu, Osogbo or a nearby community.',
    'Owns an Android smartphone with reliable mobile data.',
    'Able to work on-site 8:00 AM – 5:00 PM for five consecutive working days.',
    'Able to stand and move around supermarket shelves for extended periods.',
    'Retail or inventory experience is an advantage.'
  ],
  5, true, true, true,
  'PROJECT_BASED', 'ON_SITE',
  'Monday – Friday', '08:00', '17:00',
  '5 working days, subject to project requirements',
  'DAILY', 1000000, 1000000, 'NGN',
  true, 200000, true, false,
  'Lunch and water provided on site. Minimum daily target: 80 verified products; operational target: 100–120 verified products.',
  true, false,
  '{"owns_android": true, "smartphone_model": true, "has_mobile_data": true, "owns_laptop": false, "owns_power_bank": true, "transportation": true}'::jsonb,
  'DRAFT'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Field Operations' AND c.name = 'Inventory Operations'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO career_vacancy_locations (vacancy_id, country, state, lga, city, public_description, nearby_preferred, is_primary)
SELECT id, 'Nigeria', 'Osun', 'Ifelodun', 'Ilobu',
       'Ilobu, Osun State (exact site address shared with selected candidates)',
       true, true
FROM career_vacancies WHERE slug = 'temporary-inventory-officer-ilobu'
ON CONFLICT DO NOTHING;

INSERT INTO career_screening_questions (vacancy_id, question_text, answer_type, required, sort_order)
SELECT id, q.question_text, q.answer_type, true, q.sort_order
FROM career_vacancies v
JOIN (VALUES
  ('Do you live in Ilobu, Osogbo or a nearby community?', 'YES_NO', 10),
  ('State your current area of residence.', 'SHORT_TEXT', 20),
  ('Have you worked in a supermarket or retail store?', 'YES_NO', 30),
  ('Have you performed inventory counting or product data entry?', 'YES_NO', 40),
  ('Can you use an Android smartphone confidently?', 'YES_NO', 50),
  ('Do you own an Android smartphone?', 'YES_NO', 60),
  ('Do you own a power bank?', 'YES_NO', 70),
  ('Can you work from 8:00 AM – 5:00 PM for five consecutive working days?', 'YES_NO', 80),
  ('Can you travel to Ilobu daily?', 'YES_NO', 90),
  ('Can you accurately upload at least 80 supermarket products daily?', 'YES_NO', 100),
  ('Are you comfortable standing and moving around supermarket shelves for extended periods?', 'YES_NO', 110),
  ('State the earliest date you can start.', 'DATE', 120)
) AS q(question_text, answer_type, sort_order) ON v.slug = 'temporary-inventory-officer-ilobu';

-- ───────────────────────────  Vacancy 2: Inventory Team Lead  ───────────────────────────

INSERT INTO career_vacancies (
  title, slug, reference_number,
  department_id, job_category_id,
  short_summary, description, responsibilities, requirements,
  openings, show_openings, featured, urgent,
  employment_type, work_arrangement,
  working_days, work_start_time, work_end_time, duration_description,
  compensation_type, compensation_min_kobo, compensation_max_kobo, currency,
  show_compensation, transport_allowance_kobo, lunch_provided, accommodation_provided,
  other_benefits,
  cv_required, cover_letter_required, equipment_fields,
  status
)
SELECT
  'Inventory Team Lead',
  'inventory-team-lead-ilobu',
  'MPV-2026-0002',
  d.id, c.id,
  'Lead a five-day supermarket inventory exercise in Ilobu, Osun State. Coordinate field workers, control data quality and deliver daily progress reports.',
  'MartPoint is deploying a field team to capture a complete product database for a supermarket in Ilobu, Osun State. The Inventory Team Lead coordinates the exercise end-to-end: assigning workers to shelves and sections, running briefings, monitoring output and accuracy, and delivering a daily progress report and final handover.' || E'\n\n' ||
  'Duration: 5 working days (subject to project requirements).' || E'\n' ||
  'Working hours: 8:00 AM – 5:00 PM.' || E'\n\n' ||
  'Compensation: ₦25,000 daily plus ₦2,000 daily transport allowance. Lunch and water are provided on site.',
  ARRAY[
    'Coordinate the inventory exercise.',
    'Assign workers to shelves and store sections.',
    'Conduct morning briefings and end-of-day reconciliation.',
    'Monitor attendance, output and accuracy.',
    'Prevent duplicated product records.',
    'Resolve unclear product, barcode and pricing information.',
    'Review uploaded records.',
    'Escalate unresolved issues.',
    'Produce a daily progress report.',
    'Complete final quality control and handover.'
  ],
  ARRAY[
    'Demonstrated experience leading or supervising a field or retail team.',
    'Experience with inventory counting, stock-taking or product data capture.',
    'Working knowledge of Excel or spreadsheet reporting.',
    'Owns an Android smartphone with reliable mobile data.',
    'Able to work on-site in Ilobu 8:00 AM – 5:00 PM for five consecutive working days.'
  ],
  1, true, false, true,
  'PROJECT_BASED', 'ON_SITE',
  'Monday – Friday', '08:00', '17:00',
  '5 working days, subject to project requirements',
  'DAILY', 2500000, 2500000, 'NGN',
  true, 200000, true, false,
  'Lunch and water provided on site.',
  true, false,
  '{"owns_android": true, "smartphone_model": true, "has_mobile_data": true, "owns_laptop": true, "owns_power_bank": true, "transportation": true}'::jsonb,
  'DRAFT'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Field Operations' AND c.name = 'Field Supervision'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO career_vacancy_locations (vacancy_id, country, state, lga, city, public_description, nearby_preferred, is_primary)
SELECT id, 'Nigeria', 'Osun', 'Ifelodun', 'Ilobu',
       'Ilobu, Osun State (exact site address shared with selected candidates)',
       true, true
FROM career_vacancies WHERE slug = 'inventory-team-lead-ilobu'
ON CONFLICT DO NOTHING;

INSERT INTO career_screening_questions (vacancy_id, question_text, answer_type, required, sort_order)
SELECT id, q.question_text, q.answer_type, true, q.sort_order
FROM career_vacancies v
JOIN (VALUES
  ('Have you previously led or supervised a work team?', 'YES_NO', 10),
  ('Describe a team or project you coordinated, including team size.', 'LONG_TEXT', 20),
  ('Have you managed or participated in an inventory or stock-counting exercise?', 'YES_NO', 30),
  ('Can you reconcile daily records and spot data errors?', 'YES_NO', 40),
  ('Can you produce a written daily progress report?', 'YES_NO', 50),
  ('Can you work on-site in Ilobu from 8:00 AM – 5:00 PM for five consecutive working days?', 'YES_NO', 60),
  ('State the earliest date you can start.', 'DATE', 70)
) AS q(question_text, answer_type, sort_order) ON v.slug = 'inventory-team-lead-ilobu';

-- Excel proficiency question with options (single choice).
INSERT INTO career_screening_questions (vacancy_id, question_text, answer_type, required, sort_order)
SELECT id, 'What is your level of proficiency with Excel or spreadsheet tools?', 'SINGLE_CHOICE', true, 80
FROM career_vacancies WHERE slug = 'inventory-team-lead-ilobu';

INSERT INTO career_question_options (question_id, option_text, sort_order)
SELECT q.id, o.option_text, o.sort_order
FROM career_screening_questions q
JOIN career_vacancies v ON v.id = q.vacancy_id AND v.slug = 'inventory-team-lead-ilobu'
JOIN (VALUES ('None', 10), ('Basic', 20), ('Intermediate', 30), ('Advanced', 40)) AS o(option_text, sort_order)
  ON q.question_text = 'What is your level of proficiency with Excel or spreadsheet tools?';
