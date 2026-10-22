-- Keep rejected payment proofs auditable and link partner quote requests to
-- the normal commercial quote lifecycle.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_origin TEXT NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS partner_quote_request_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_quote_origin_check'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_quote_origin_check
      CHECK (quote_origin IN ('DIRECT', 'PARTNER_REQUEST'));
  END IF;
END $$;

ALTER TABLE partner_quote_requests
  ADD COLUMN IF NOT EXISTS quote_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_partner_quote_request_id_fkey'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_partner_quote_request_id_fkey
      FOREIGN KEY (partner_quote_request_id)
      REFERENCES partner_quote_requests(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_quote_requests_quote_id_fkey'
  ) THEN
    ALTER TABLE partner_quote_requests
      ADD CONSTRAINT partner_quote_requests_quote_id_fkey
      FOREIGN KEY (quote_id)
      REFERENCES quotes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quotes_quote_origin_idx ON quotes (quote_origin);
CREATE INDEX IF NOT EXISTS quotes_partner_quote_request_id_idx ON quotes (partner_quote_request_id);
CREATE INDEX IF NOT EXISTS partner_quote_requests_quote_id_idx ON partner_quote_requests (quote_id);

-- Backfill open legacy requests so the Finance Quotes workspace is complete
-- immediately after this migration is applied.
DO $$
DECLARE
  request_row RECORD;
  new_quote_id UUID;
  existing_quote_id UUID;
  new_quote_number TEXT;
  quote_total NUMERIC(14,2);
  quote_currency TEXT;
BEGIN
  FOR request_row IN
    SELECT r.*, p.base_price, p.currency AS plan_currency
    FROM partner_quote_requests r
    LEFT JOIN plans p ON p.id = r.plan_id
    WHERE r.quote_id IS NULL
      AND r.status IN ('SUBMITTED', 'UNDER_REVIEW')
  LOOP
    existing_quote_id := NULL;
    IF NULLIF(TRIM(request_row.issued_quote_ref), '') IS NOT NULL THEN
      SELECT id INTO existing_quote_id
      FROM quotes
      WHERE quote_number = TRIM(request_row.issued_quote_ref)
      LIMIT 1;
    END IF;

    IF existing_quote_id IS NOT NULL THEN
      UPDATE quotes
        SET partner_id = COALESCE(partner_id, request_row.partner_id),
            partner_lead_id = COALESCE(partner_lead_id, request_row.partner_lead_id),
            partner_quote_request_id = request_row.id,
            quote_origin = 'PARTNER_REQUEST',
            updated_at = now()
        WHERE id = existing_quote_id;
      UPDATE partner_quote_requests
        SET quote_id = existing_quote_id, updated_at = now()
        WHERE id = request_row.id;
      CONTINUE;
    END IF;

    new_quote_number := next_quote_number(EXTRACT(YEAR FROM COALESCE(request_row.created_at, now()))::INTEGER);
    quote_total := COALESCE(request_row.base_price, 0);
    quote_currency := COALESCE(request_row.plan_currency, 'NGN');

    INSERT INTO quotes (
      quote_number, business_id, partner_id, partner_lead_id,
      partner_quote_request_id, quote_origin, plan_id, status, currency,
      subtotal, discount_amount, tax_amount, total_amount, valid_until,
      notes_internal, created_by, created_at, updated_at
    ) VALUES (
      new_quote_number, NULL, request_row.partner_id, request_row.partner_lead_id,
      request_row.id, 'PARTNER_REQUEST', request_row.plan_id, 'DRAFT', quote_currency,
      quote_total, 0, 0, quote_total,
      (COALESCE(request_row.created_at, now()) + INTERVAL '14 days')::DATE,
      concat_ws(E'\n',
        'Backfilled from a partner quote request.',
        CASE WHEN request_row.locations IS NOT NULL THEN 'Locations: ' || request_row.locations END,
        CASE WHEN request_row.users_estimate IS NOT NULL THEN 'Estimated users: ' || request_row.users_estimate END,
        CASE WHEN request_row.services_requested IS NOT NULL THEN 'Services requested: ' || request_row.services_requested END,
        CASE WHEN request_row.assumptions IS NOT NULL THEN 'Assumptions: ' || request_row.assumptions END,
        CASE WHEN request_row.notes IS NOT NULL THEN 'Partner notes: ' || request_row.notes END
      ),
      request_row.requested_by, COALESCE(request_row.created_at, now()), COALESCE(request_row.updated_at, now())
    ) RETURNING id INTO new_quote_id;

    INSERT INTO quote_items (
      quote_id, item_type, reference_id, description, quantity,
      unit_price, discount, tax, tax_rate, line_total
    ) VALUES (
      new_quote_id, 'PLAN', request_row.plan_id, COALESCE(request_row.plan_name, 'Requested plan'),
      1, quote_total, 0, 0, 0, quote_total
    );

    UPDATE partner_quote_requests
      SET quote_id = new_quote_id, updated_at = now()
      WHERE id = request_row.id;
  END LOOP;
END $$;
