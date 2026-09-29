-- 060: Seed — conversion-first workforce role templates (all INACTIVE) and the
-- conversion-pipeline stage ownership map. No vacancies are created or
-- published here; templates only prefill vacancies an admin chooses to create.
-- Idempotent — keyed on (name, role_category) / stage_key.

-- Lookups needed by retainer/professional-service roles.
INSERT INTO career_departments (name, description, sort_order) VALUES
  ('Finance & Admin', 'Finance, accounting, payments and administration.', 70)
ON CONFLICT (name) DO NOTHING;

INSERT INTO career_job_categories (name, description, sort_order) VALUES
  ('Professional Services', 'Retained professional advisers and specialist contractors.', 60)
ON CONFLICT (name) DO NOTHING;

-- ───────────────────────────  Conversion pipeline stage owners  ───────────────────────────

INSERT INTO career_pipeline_stage_owners (stage_key, label, responsible_role, sort_order) VALUES
  ('NEW_LEAD',              'New lead & first contact',        'Business Development/Conversion Officer',   10),
  ('QUALIFICATION',         'Qualification',                   'Business Development/Conversion Officer',   20),
  ('DEMO',                  'Demo preparation & delivery',     'Product Demo & Solutions Specialist',       30),
  ('PROPOSAL',              'Proposal & follow-up',            'Business Development/Conversion Officer',   40),
  ('COMMERCIAL_APPROVAL',   'Commercial approval',             'Sales & Conversion Lead',                   50),
  ('ENTERPRISE_APPROVAL',   'Enterprise approval',             'Founder/Authorised Director',               60),
  ('PAYMENT_CONFIRMATION',  'Payment confirmation',            'Finance/Admin',                             70),
  ('IMPLEMENTATION',        'Implementation handover',         'Implementation & Customer Success Specialist', 80),
  ('ACTIVATION',            'Customer activation',             'Implementation & Customer Success Specialist', 90),
  ('POST_GO_LIVE_SUPPORT',  'Post-go-live support',            'Customer Support Officer',                 100),
  ('ADOPTION_RENEWAL',      'Adoption & renewal',              'Customer Success',                         110),
  ('MARKETING_ATTRIBUTION', 'Marketing attribution',           'Content & Growth Officer',                 120)
ON CONFLICT (stage_key) DO UPDATE SET
  label = EXCLUDED.label,
  responsible_role = EXCLUDED.responsible_role,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ───────────────────────────  Core roles  ───────────────────────────

-- 1. Sales & Conversion Lead
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  base_compensation_kobo, compensation_type, currency,
  commission_eligible, commission_rules, performance_bonus,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, consent_text, status
)
SELECT
  'Sales & Conversion Lead', 'CORE', d.id, c.id,
  'Owns the end-to-end conversion pipeline and is accountable for collected revenue. Leads the conversion officers and demo specialists, approves commercial terms, and enforces CRM hygiene and daily pipeline updates.',
  'PERMANENT', 'HYBRID', 1,
  ARRAY[
    'Own the lead-to-payment conversion pipeline and its weekly targets.',
    'Supervise Conversion Officers and Demo Specialists; review daily task and pipeline updates in the CRM.',
    'Approve proposals, discounts and commercial terms within delegated limits.',
    'Escalate enterprise deals to the Founder/Authorised Director.',
    'Run the weekly performance review; report conversion, collected revenue and cycle time.',
    'Maintain CRM data quality and enforce handover discipline between pipeline stages.',
    'Coach the team on objection handling, follow-up cadence and closing.'
  ],
  ARRAY[
    'Proven B2B sales or team-lead experience, ideally selling software or retail technology.',
    'Track record of hitting collected-revenue targets.',
    'Strong CRM discipline and pipeline reporting skills.',
    'Owns a laptop and has reliable internet for hybrid work.',
    'Excellent written and spoken communication.'
  ],
  ARRAY[
    'Lead-to-payment conversion rate',
    'Revenue collected (qualifying payments only)',
    'Average sales cycle length',
    'Demo-to-payment conversion',
    'Team CRM hygiene: daily updates completed',
    'Renewal and retention of converted customers'
  ],
  'Founder/Authorised Director', 'Monday – Friday', '08:30', '17:30', '3 months',
  NULL, 'SALARY_PLUS_COMMISSION', 'NGN',
  true,
  '{"basis":"PERCENTAGE","self_lead_rate":3,"company_lead_rate":1.5,"excluded_categories":["Taxes","Refunds","Logistics","Reimbursable Expenses","Hardware"],"minimum_payout_kobo":500000,"clawback_on_refund":true}'::jsonb,
  'Team-performance bonus when the team exceeds the quarterly collected-revenue target.',
  false,
  '{"owns_laptop": true, "has_mobile_data": true, "owns_android": true}'::jsonb,
  '[
    {"question_text": "Have you led a sales or conversion team before?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Describe the largest deal you personally closed and how the payment was collected.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Which CRM tools have you used to manage a pipeline?", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Are you comfortable being measured on collected revenue rather than activity?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  '[{"criterion":"Pipeline leadership","max_score":10},{"criterion":"Revenue accountability","max_score":10},{"criterion":"CRM discipline","max_score":10},{"criterion":"Communication","max_score":10}]'::jsonb,
  NULL,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Sales' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- 2. Business Development/Conversion Officer
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  compensation_type, currency, commission_eligible, commission_rules,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Business Development/Conversion Officer', 'CORE', d.id, c.id,
  'Owns new-lead first contact, qualification and proposal follow-up. Converts interested businesses into paying customers through disciplined outreach and fast response times.',
  'PERMANENT', 'HYBRID', 2,
  ARRAY[
    'Make first contact with every new lead within the agreed response-time target.',
    'Qualify leads against the ideal customer profile and record outcomes in the CRM.',
    'Prepare proposals and follow up until a clear yes/no.',
    'Hand over won deals to Implementation with a complete handover record.',
    'Update tasks and pipeline daily; attend the weekly performance review.',
    'Log marketing-source attribution details for every lead touched.'
  ],
  ARRAY[
    '1+ year in sales, telesales or business development.',
    'Confident phone, WhatsApp and email communication.',
    'Owns an Android smartphone and laptop with reliable data.',
    'Able to work hybrid; CRM usage is mandatory.',
    'Target-driven and comfortable with measured KPIs.'
  ],
  ARRAY[
    'First-response time to new leads',
    'Contact rate',
    'Qualified leads produced',
    'Proposals issued and proposal win rate',
    'Collected revenue from qualifying payments',
    'Lead-to-payment conversion rate'
  ],
  'Sales & Conversion Lead', 'Monday – Friday', '08:30', '17:30', '3 months',
  'SALARY_PLUS_COMMISSION', 'NGN', true,
  '{"basis":"PERCENTAGE","self_lead_rate":5,"company_lead_rate":2.5,"excluded_categories":["Taxes","Refunds","Logistics","Reimbursable Expenses","Hardware"],"minimum_payout_kobo":500000,"clawback_on_refund":true}'::jsonb,
  false,
  '{"owns_android": true, "owns_laptop": true, "has_mobile_data": true, "transportation": true}'::jsonb,
  '[
    {"question_text": "Have you worked in sales or business development?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "How quickly do you believe a new lead should be contacted?", "answer_type": "SINGLE_CHOICE", "required": true, "knockout": false, "options": ["Within 5 minutes", "Within 1 hour", "Same day", "Within a week"]},
    {"question_text": "Describe a sale you closed from first contact to payment.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Do you own an Android smartphone and a laptop?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  '[{"criterion":"Sales experience","max_score":10},{"criterion":"Objection handling","max_score":10},{"criterion":"CRM discipline","max_score":10},{"criterion":"Communication","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Sales' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- 3. Product Demo & Solutions Specialist
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  compensation_type, currency, commission_eligible,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Product Demo & Solutions Specialist', 'CORE', d.id, c.id,
  'Prepares and delivers compelling product demos that map MartPoint to each prospect''s actual workflow, and hands demo outcomes back to the Conversion Officer for follow-up.',
  'PERMANENT', 'HYBRID', 1,
  ARRAY[
    'Prepare tailored demo environments and scripts per qualified lead.',
    'Deliver in-person and remote product demos.',
    'Answer technical and workflow questions during demos.',
    'Record demo outcomes, objections and feature requests in the CRM.',
    'Hand over demo results to the owning Conversion Officer the same day.',
    'Keep demo data, devices and scripts current.'
  ],
  ARRAY[
    'Deep familiarity with POS or retail workflows.',
    'Strong presentation and storytelling skills.',
    'Owns a laptop and Android smartphone with reliable data.',
    'Able to travel for on-site demos when required (approved travel reimbursed).'
  ],
  ARRAY[
    'Demos booked and completed',
    'Demo attendance rate',
    'Demo-to-payment conversion',
    'Same-day handover completion'
  ],
  'Sales & Conversion Lead', 'Monday – Friday', '08:30', '17:30', '3 months',
  'MONTHLY', 'NGN', true,
  false,
  '{"owns_laptop": true, "owns_android": true, "has_mobile_data": true}'::jsonb,
  '[
    {"question_text": "Have you delivered product demos or training to customers?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Are you experienced with POS or retail software?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Describe how you would demo MartPoint to a supermarket owner.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRACTICAL',
  '[{"criterion":"Product knowledge","max_score":10},{"criterion":"Presentation","max_score":10},{"criterion":"Discovery questions","max_score":10},{"criterion":"Objection handling","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Sales' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- 4. Implementation & Customer Success Specialist
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  compensation_type, currency, performance_bonus,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Implementation & Customer Success Specialist', 'CORE', d.id, c.id,
  'Takes over won deals, implements MartPoint at the customer site, drives activation and first value, and owns adoption and renewal thereafter.',
  'PERMANENT', 'HYBRID', 1,
  ARRAY[
    'Accept implementation handovers and confirm scope, deadline and required actions.',
    'Configure stores, import products and train customer staff.',
    'Drive customer activation to first live transaction.',
    'Monitor usage at day 14 and day 30; intervene early on inactivity.',
    'Own renewals and expansion conversations.',
    'Log all customer interactions and risks in the CRM.'
  ],
  ARRAY[
    'Experience implementing software or onboarding business customers.',
    'Organised, calm under pressure, excellent trainer.',
    'Owns a laptop and Android smartphone with reliable data.',
    'Able to travel to customer sites (approved travel reimbursed).'
  ],
  ARRAY[
    'Customers activated',
    'Time to activation',
    'Active usage after 14 and 30 days',
    'Renewal rate and churn',
    'Customer satisfaction'
  ],
  'Sales & Conversion Lead', 'Monday – Friday', '08:30', '17:30', '3 months',
  'MONTHLY', 'NGN',
  'Retention bonus for customers still active after 90 days.',
  false,
  '{"owns_laptop": true, "owns_android": true, "has_mobile_data": true, "transportation": true}'::jsonb,
  '[
    {"question_text": "Have you onboarded or trained business customers on software?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "A customer stops using the product after go-live. What do you do?", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Can you travel to customer sites when required?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  '[{"criterion":"Implementation experience","max_score":10},{"criterion":"Training ability","max_score":10},{"criterion":"Problem solving","max_score":10},{"criterion":"Ownership","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Customer Success' AND c.name = 'Customer Success'
ON CONFLICT (name, role_category) DO NOTHING;

-- 5. Customer Support Officer
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  compensation_type, currency,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Customer Support Officer', 'CORE', d.id, c.id,
  'Owns post-go-live customer support: fast response, accurate triage, and documented resolution of customer issues.',
  'PERMANENT', 'HYBRID', 1,
  ARRAY[
    'Respond to customer issues within the agreed response-time SLA.',
    'Triage, resolve or escalate issues with clear notes.',
    'Maintain the help centre and canned responses.',
    'Report recurring issues to the Implementation and Tech teams.',
    'Emergency or weekend coverage only through an approved roster.'
  ],
  ARRAY[
    'Customer service experience, ideally for a software product.',
    'Patient, clear written communication.',
    'Owns a laptop and reliable data connection.',
    'Available Monday–Friday 9:00 AM – 5:00 PM WAT.'
  ],
  ARRAY[
    'Support response time',
    'First-contact resolution rate',
    'Customer satisfaction (CSAT)',
    'Escalation accuracy'
  ],
  'Implementation & Customer Success Specialist', 'Monday – Friday', '09:00', '17:00', '3 months',
  'MONTHLY', 'NGN',
  false,
  '{"owns_laptop": true, "has_mobile_data": true}'::jsonb,
  '[
    {"question_text": "Have you worked in customer support?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "A frustrated customer reports a failed transaction. Walk through your response.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Can you work 9:00 AM – 5:00 PM WAT, Monday–Friday?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'WRITTEN',
  '[{"criterion":"Support experience","max_score":10},{"criterion":"Written communication","max_score":10},{"criterion":"Empathy","max_score":10},{"criterion":"Technical aptitude","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Customer Success' AND c.name = 'Customer Success'
ON CONFLICT (name, role_category) DO NOTHING;

-- 6. Content & Growth Officer
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time, probation_period,
  compensation_type, currency,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Content & Growth Officer', 'CORE', d.id, c.id,
  'Owns marketing attribution and lead-generating content: every campaign must be measurable to leads received and, ultimately, to collected revenue.',
  'PERMANENT', 'HYBRID', 1,
  ARRAY[
    'Produce conversion-focused content: landing pages, social, email and sales collateral.',
    'Tag and track every campaign so lead sources are attributable.',
    'Report leads received and cost per lead per channel weekly.',
    'Support demo and proposal material for the conversion team.',
    'Maintain the content calendar and asset library.'
  ],
  ARRAY[
    'Content, social or growth marketing experience.',
    'Strong writing and basic design/video tooling skills.',
    'Understands attribution and UTMs.',
    'Owns a laptop with reliable data.'
  ],
  ARRAY[
    'Leads received per channel',
    'Marketing-attributed pipeline revenue',
    'Content shipped per week',
    'Cost per qualified lead'
  ],
  'Sales & Conversion Lead', 'Monday – Friday', '08:30', '17:30', '3 months',
  'MONTHLY', 'NGN',
  false,
  '{"owns_laptop": true, "has_mobile_data": true}'::jsonb,
  '[
    {"question_text": "Share links to content or campaigns you have produced.", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Have you measured marketing results with UTMs or analytics?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Write a three-line LinkedIn post announcing a MartPoint demo day.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRACTICAL',
  '[{"criterion":"Portfolio quality","max_score":10},{"criterion":"Attribution literacy","max_score":10},{"criterion":"Writing","max_score":10},{"criterion":"Speed of execution","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Marketing' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- ───────────────────────────  Flexible workforce  ───────────────────────────

-- 7. Field Implementation Technician
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time,
  compensation_type, currency,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Field Implementation Technician', 'FLEXIBLE', d.id, c.id,
  'On-call technician dispatched for hardware setup, network configuration and on-site implementation work at customer locations.',
  'ON_CALL_FIELD', 'FIELD_BASED', 3,
  ARRAY[
    'Install and configure POS hardware, printers, scanners and network equipment.',
    'Complete on-site implementation checklists and capture sign-off.',
    'Troubleshoot hardware and connectivity issues in the field.',
    'Submit same-day field reports with photos where required.'
  ],
  ARRAY[
    'Hands-on experience with POS hardware, networking or IT support.',
    'Owns an Android smartphone with mobile data.',
    'Able to travel to customer sites on short notice.',
    'Basic toolkit preferred.'
  ],
  ARRAY[
    'Deployments completed on schedule',
    'First-time-right install rate',
    'Same-day report submission',
    'Customer satisfaction at install'
  ],
  'Implementation & Customer Success Specialist', 'Monday – Saturday (on call)', '08:00', '17:00',
  'PROJECT_FEE', 'NGN',
  false,
  '{"owns_android": true, "has_mobile_data": true, "transportation": true, "items": ["Android smartphone", "Basic tool kit", "Laptop preferred"]}'::jsonb,
  '[
    {"question_text": "Have you installed or maintained POS hardware or computer networks?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Describe the field equipment you have worked with.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Can you travel to customer sites on short notice?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRACTICAL',
  '[{"criterion":"Hardware skills","max_score":10},{"criterion":"Field reliability","max_score":10},{"criterion":"Reporting quality","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Customer Success' AND c.name = 'Customer Success'
ON CONFLICT (name, role_category) DO NOTHING;

-- 8. Temporary Inventory Officer (approved Ilobu values)
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, default_location, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time,
  base_compensation_kobo, compensation_type, currency,
  transport_allowance_kobo, feeding_arrangement,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, status
)
SELECT
  'Temporary Inventory Officer', 'FLEXIBLE', d.id, c.id,
  'Short-term field role capturing supermarket product data (names, brands, categories, barcodes, pack sizes, prices, opening stock) using an Android smartphone. Payment after verified work; attendance and daily output are verified.',
  'PROJECT_BASED', 'ON_SITE',
  '{"country":"Nigeria","state":"Osun","lga":"Ifelodun","city":"Ilobu","public_description":"Ilobu, Osun State (exact site address shared with selected candidates)","nearby_preferred":true}'::jsonb,
  5,
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
    'Lives near the deployment site.',
    'Owns an Android smartphone with reliable mobile data.',
    'Able to work on-site 8:00 AM – 5:00 PM for the project duration.',
    'Able to stand and move around supermarket shelves for extended periods.',
    'Retail or inventory experience is an advantage.'
  ],
  ARRAY[
    'Verified products captured per day (min 80; target 100–120)',
    'Error rate on captured records',
    'Attendance verification'
  ],
  'Inventory Team Lead', 'Monday – Friday', '08:00', '17:00',
  1000000, 'DAILY_PLUS_TRANSPORT', 'NGN',
  200000, 'Lunch and water provided on site.',
  true,
  '{"owns_android": true, "smartphone_model": true, "has_mobile_data": true, "owns_power_bank": true, "transportation": true}'::jsonb,
  '[
    {"question_text": "Do you live near the deployment location?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "State your current area of residence.", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Have you worked in a supermarket or retail store?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Have you performed inventory counting or product data entry?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Do you own an Android smartphone with mobile data?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Do you own a power bank?", "answer_type": "YES_NO", "required": false, "knockout": false, "options": []},
    {"question_text": "Can you work on-site 8:00 AM – 5:00 PM for the full project duration?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Can you accurately upload at least 80 supermarket products daily?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "State the earliest date you can start.", "answer_type": "DATE", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRODUCT_CAPTURE',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Field Operations' AND c.name = 'Inventory Operations'
ON CONFLICT (name, role_category) DO NOTHING;

-- 9. Inventory Team Lead (approved Ilobu values)
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, default_location, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days, work_start_time, work_end_time,
  base_compensation_kobo, compensation_type, currency,
  transport_allowance_kobo, feeding_arrangement,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, interview_scorecard, status
)
SELECT
  'Inventory Team Lead', 'FLEXIBLE', d.id, c.id,
  'Coordinates a field inventory exercise end-to-end: assigns workers to shelves and sections, runs briefings, verifies attendance and daily output, controls data quality and delivers daily progress reports and final handover.',
  'PROJECT_BASED', 'ON_SITE',
  '{"country":"Nigeria","state":"Osun","lga":"Ifelodun","city":"Ilobu","public_description":"Ilobu, Osun State (exact site address shared with selected candidates)","nearby_preferred":true}'::jsonb,
  1,
  ARRAY[
    'Coordinate the inventory exercise.',
    'Assign workers to shelves and store sections.',
    'Conduct morning briefings and end-of-day reconciliation.',
    'Verify attendance and daily output for every worker.',
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
    'Able to work on-site for the full project duration.'
  ],
  ARRAY[
    'Team verified products per day',
    'Team error rate',
    'Daily report delivered on time',
    'Exercise completed within the timeline'
  ],
  'Deployment Supervisor', 'Monday – Friday', '08:00', '17:00',
  2500000, 'DAILY_PLUS_TRANSPORT', 'NGN',
  200000, 'Lunch and water provided on site.',
  true,
  '{"owns_android": true, "smartphone_model": true, "has_mobile_data": true, "owns_laptop": true, "owns_power_bank": true, "transportation": true}'::jsonb,
  '[
    {"question_text": "Have you previously led or supervised a work team?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Describe a team or project you coordinated, including team size.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Have you managed or participated in an inventory or stock-counting exercise?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Can you reconcile daily records and spot data errors?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Can you produce a written daily progress report?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "What is your level of proficiency with Excel or spreadsheet tools?", "answer_type": "SINGLE_CHOICE", "required": true, "knockout": false, "options": ["None", "Basic", "Intermediate", "Advanced"]},
    {"question_text": "State the earliest date you can start.", "answer_type": "DATE", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  '[{"criterion":"Team leadership","max_score":10},{"criterion":"Inventory experience","max_score":10},{"criterion":"Reporting ability","max_score":10},{"criterion":"Attention to detail","max_score":10}]'::jsonb,
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Field Operations' AND c.name = 'Field Supervision'
ON CONFLICT (name, role_category) DO NOTHING;

-- 10. Independent Sales Agent
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days,
  compensation_type, currency, commission_eligible, commission_rules,
  show_compensation_public, required_equipment, screening_questions,
  assessment_type, consent_text, status
)
SELECT
  'Independent Sales Agent', 'FLEXIBLE', d.id, c.id,
  'Self-directed agent who generates and converts their own leads for MartPoint on a commission-only basis. Commission is earned only on qualifying collected revenue.',
  'CONTRACT', 'FIELD_BASED', 10,
  ARRAY[
    'Source and qualify own leads within assigned territory or segment.',
    'Present MartPoint and coordinate demos with the Demo Specialist.',
    'Follow up proposals to collected payment.',
    'Record all lead activity and attribution in the CRM.',
    'Maintain confidentiality and data-protection obligations.'
  ],
  ARRAY[
    'Existing network of retail or business contacts.',
    'Self-motivated; proven commission sales experience preferred.',
    'Owns an Android smartphone with mobile data.',
    'No fixed hours — results measured on collected revenue.'
  ],
  ARRAY[
    'Self-generated leads converted to collected payment',
    'Qualifying collected revenue',
    'CRM logging compliance'
  ],
  'Sales & Conversion Lead', 'Flexible',
  'COMMISSION_ONLY', 'NGN', true,
  '{"basis":"PERCENTAGE","self_lead_rate":10,"company_lead_rate":4,"excluded_categories":["Taxes","Refunds","Logistics","Reimbursable Expenses","Hardware"],"minimum_payout_kobo":500000,"clawback_on_refund":true}'::jsonb,
  false,
  '{"owns_android": true, "has_mobile_data": true}'::jsonb,
  '[
    {"question_text": "Do you have an existing network of businesses you can sell to?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Which city or territory would you cover?", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Are you comfortable working on commission-only earnings?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  'I understand this is a commission-only engagement and that commission is paid only on qualifying collected revenue, subject to the stated commission rules.',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Sales' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- 11. Channel/Referral Partner
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line,
  compensation_type, currency, commission_eligible, commission_rules,
  show_compensation_public, screening_questions, assessment_type, consent_text, status
)
SELECT
  'Channel/Referral Partner', 'FLEXIBLE', d.id, c.id,
  'Referral partner who introduces qualified businesses to MartPoint and earns commission on qualifying collected revenue from referred customers.',
  'CONTRACT', 'REMOTE', 10,
  ARRAY[
    'Refer qualified businesses to MartPoint through the referral process.',
    'Provide warm introductions and context to the conversion team.',
    'Track referral outcomes through attributed records.',
    'Maintain confidentiality of shared business information.'
  ],
  ARRAY[
    'Established professional network in retail, hospitality or trade.',
    'Able to make warm introductions — not cold lead lists.',
    'No fixed hours; reward is commission on collected revenue.'
  ],
  ARRAY[
    'Referred leads that reach payment',
    'Qualifying collected revenue from referrals'
  ],
  'Sales & Conversion Lead',
  'COMMISSION_ONLY', 'NGN', true,
  '{"basis":"PERCENTAGE","self_lead_rate":7,"company_lead_rate":0,"excluded_categories":["Taxes","Refunds","Logistics","Reimbursable Expenses","Hardware"],"minimum_payout_kobo":500000,"clawback_on_refund":true}'::jsonb,
  false,
  '[
    {"question_text": "Describe the business network you would refer from.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Have you acted as a referral partner or reseller before?", "answer_type": "YES_NO", "required": true, "knockout": false, "options": []},
    {"question_text": "Do you accept commission on collected revenue only?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  'I understand commission is earned only on qualifying collected revenue from referred customers, excluding taxes, refunds, logistics, reimbursable expenses and hardware unless explicitly approved.',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Sales' AND c.name = 'Sales & Marketing'
ON CONFLICT (name, role_category) DO NOTHING;

-- ───────────────────────────  Supporting retainer categories  ───────────────────────────

-- 12. Accountant/Bookkeeper
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days,
  compensation_type, currency,
  show_compensation_public, screening_questions, assessment_type, status
)
SELECT
  'Accountant/Bookkeeper', 'RETAINER', d.id, c.id,
  'Retained finance support: monthly books, reconciliations, payment confirmation support for the conversion pipeline, and commission payout verification.',
  'CONTRACT', 'REMOTE', 1,
  ARRAY[
    'Maintain monthly books and reconciliations.',
    'Verify collected revenue for commission calculation.',
    'Confirm customer payments in the pipeline.',
    'Prepare monthly finance summaries and flag anomalies.',
    'Support payroll and contractor payment runs.'
  ],
  ARRAY[
    'Qualified accountant or experienced bookkeeper (ICAN/ATS advantage).',
    'Proficient with accounting software and spreadsheets.',
    'Available for agreed monthly retainer deliverables.',
    'Strict confidentiality with financial data.'
  ],
  ARRAY[
    'Books closed on schedule',
    'Reconciliation accuracy',
    'Payment-confirmation turnaround time'
  ],
  'Founder/Authorised Director', 'Flexible — agreed retainer hours',
  'RETAINER', 'NGN',
  false,
  '[
    {"question_text": "What accounting or bookkeeping qualifications do you hold?", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Which accounting tools have you used?", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "How many years of bookkeeping experience do you have?", "answer_type": "NUMBER", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'WRITTEN',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Finance & Admin' AND c.name = 'Professional Services'
ON CONFLICT (name, role_category) DO NOTHING;

-- 13. Legal/HR Adviser
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days,
  compensation_type, currency,
  show_compensation_public, screening_questions, assessment_type, status
)
SELECT
  'Legal/HR Adviser', 'RETAINER', d.id, c.id,
  'Retained adviser for employment contracts, contractor agreements, confidentiality and data-protection obligations, and ad-hoc legal review.',
  'CONTRACT', 'REMOTE', 1,
  ARRAY[
    'Review and maintain employment offer templates and contractor agreements.',
    'Advise on confidentiality, data-protection and workforce compliance.',
    'Review customer-facing legal documents on request.',
    'Respond to agreed SLAs for retainer advisory requests.'
  ],
  ARRAY[
    'Qualified legal practitioner or experienced HR adviser.',
    'Experience with Nigerian employment and contract law.',
    'Available for agreed retainer advisory hours.'
  ],
  ARRAY[
    'Advisory turnaround time',
    'Document review quality',
    'Compliance issues prevented'
  ],
  'Founder/Authorised Director', 'Flexible — agreed retainer hours',
  'RETAINER', 'NGN',
  false,
  '[
    {"question_text": "Summarise your legal or HR advisory experience.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []},
    {"question_text": "Are you familiar with Nigerian employment law?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "What is your availability for retainer advisory work?", "answer_type": "SHORT_TEXT", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'INTERVIEW',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'People & HR' AND c.name = 'Professional Services'
ON CONFLICT (name, role_category) DO NOTHING;

-- 14. Photographer/Videographer
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line,
  compensation_type, currency,
  show_compensation_public, required_equipment, screening_questions, assessment_type, status
)
SELECT
  'Photographer/Videographer', 'RETAINER', d.id, c.id,
  'Project-based visual content production: product shots, demo videos, customer stories and campaign assets for the growth team.',
  'CONTRACT', 'FIELD_BASED', 1,
  ARRAY[
    'Shoot and edit photo and video assets to brief.',
    'Produce product demos, customer stories and campaign visuals.',
    'Deliver assets in agreed formats and turnaround times.',
    'Maintain an organised asset library handover.'
  ],
  ARRAY[
    'Portfolio of commercial photo/video work.',
    'Owns camera and editing equipment.',
    'Able to travel to shoot locations (approved travel reimbursed).'
  ],
  ARRAY[
    'Assets delivered per brief',
    'Turnaround time',
    'Asset acceptance rate'
  ],
  'Content & Growth Officer',
  'PROJECT_FEE', 'NGN',
  false,
  '{"items": ["Camera and lenses", "Editing workstation/software", "Lighting kit preferred"]}'::jsonb,
  '[
    {"question_text": "Share a link to your portfolio.", "answer_type": "SHORT_TEXT", "required": true, "knockout": true, "options": []},
    {"question_text": "Do you own your camera and editing equipment?", "answer_type": "YES_NO", "required": true, "knockout": true, "options": []},
    {"question_text": "Describe a commercial shoot you delivered end-to-end.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRACTICAL',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Marketing' AND c.name = 'Professional Services'
ON CONFLICT (name, role_category) DO NOTHING;

-- 15. Software Engineering Contractor
INSERT INTO career_role_templates (
  name, role_category, department_id, job_category_id, purpose,
  employment_type, work_arrangement, openings,
  responsibilities, requirements, performance_indicators,
  reporting_line, working_days,
  compensation_type, currency,
  show_compensation_public, required_equipment, screening_questions, assessment_type, consent_text, status
)
SELECT
  'Software Engineering Contractor', 'RETAINER', d.id, c.id,
  'Scoped engineering work on the MartPoint platform — features, integrations and fixes — delivered against written statements of work.',
  'CONTRACT', 'REMOTE', 2,
  ARRAY[
    'Deliver scoped engineering work against written statements of work.',
    'Follow existing codebase conventions and review processes.',
    'Write tested, documented, production-ready code.',
    'Provide handover notes for every deliverable.'
  ],
  ARRAY[
    'Strong TypeScript/Next.js experience.',
    'Experience with Postgres/Supabase an advantage.',
    'Portfolio or repository links required.',
    'Owns a suitable development machine.'
  ],
  ARRAY[
    'Deliverables accepted on schedule',
    'Defect rate on delivered work',
    'Code review turnaround'
  ],
  'Founder/Authorised Director', 'Flexible — per statement of work',
  'PROJECT_FEE', 'NGN',
  false,
  '{"owns_laptop": true, "has_mobile_data": true}'::jsonb,
  '[
    {"question_text": "Share links to repositories or shipped work.", "answer_type": "SHORT_TEXT", "required": true, "knockout": true, "options": []},
    {"question_text": "How many years of production TypeScript/Next.js experience do you have?", "answer_type": "NUMBER", "required": true, "knockout": false, "options": []},
    {"question_text": "Describe a feature you shipped end-to-end recently.", "answer_type": "LONG_TEXT", "required": true, "knockout": false, "options": []}
  ]'::jsonb,
  'PRACTICAL',
  'Contractor work product is assigned to MartPoint under the agreed statement of work and confidentiality terms.',
  'INACTIVE'
FROM career_departments d, career_job_categories c
WHERE d.name = 'Engineering' AND c.name = 'Engineering'
ON CONFLICT (name, role_category) DO NOTHING;
