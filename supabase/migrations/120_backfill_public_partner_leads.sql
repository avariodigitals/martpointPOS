-- Public partner-directory enquiries were historically stored only in `leads`
-- with `referring_partner_code`. Mirror those records into the partner lead
-- workflow so the owning partner can see and follow them in the portal.

CREATE INDEX IF NOT EXISTS partner_leads_matched_lead_idx
  ON partner_leads (matched_lead_id)
  WHERE matched_lead_id IS NOT NULL;

INSERT INTO partner_leads (
  partner_id,
  submitted_by_partner_user_id,
  business_name,
  contact_name,
  phone,
  email,
  country,
  state,
  city,
  industry,
  business_type,
  estimated_branches,
  estimated_users,
  interested_product,
  notes,
  status,
  protection_status,
  protection_expires_at,
  matched_lead_id,
  matched_business_id,
  created_at,
  updated_at
)
SELECT
  p.id,
  NULL,
  l.business_name,
  l.full_name,
  l.phone,
  l.email,
  'Nigeria',
  '',
  '',
  l.industry,
  l.business_type,
  CASE WHEN l.branches ~ '^[0-9]+$' THEN l.branches::INTEGER ELSE NULL END,
  CASE WHEN l.staff_size ~ '^[0-9]+$' THEN l.staff_size::INTEGER ELSE NULL END,
  l.product_interest,
  NULLIF(CONCAT_WS(E'\n\n', NULLIF(l.challenge, ''), NULLIF(l.message, '')), ''),
  'REGISTERED',
  'PENDING',
  NULL,
  l.id,
  NULL,
  COALESCE(l.submitted_at, now()),
  COALESCE(l.updated_at, l.submitted_at, now())
FROM leads l
JOIN partners p
  ON UPPER(p.partner_id) = UPPER(l.referring_partner_code)
 AND p.status = 'ACTIVE'
WHERE l.referring_partner_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM partner_leads existing
    WHERE existing.matched_lead_id = l.id
  );

-- Give backfilled leads the same in-portal visibility as new submissions.
INSERT INTO partner_notifications (
  partner_id,
  type,
  title,
  body,
  link,
  source_type,
  source_id
)
SELECT
  pl.partner_id,
  'LEAD_RECEIVED',
  'New customer lead received',
  CONCAT(pl.business_name, ' · ', pl.contact_name, ' submitted an enquiry through your public MartPoint partner profile.'),
  CONCAT('/partner/leads/', pl.id),
  'partner_lead',
  pl.id::TEXT
FROM partner_leads pl
JOIN leads l ON l.id = pl.matched_lead_id
WHERE l.referring_partner_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM partner_notifications pn
    WHERE pn.type = 'LEAD_RECEIVED'
      AND pn.source_type = 'partner_lead'
      AND pn.source_id = pl.id::TEXT
  );
