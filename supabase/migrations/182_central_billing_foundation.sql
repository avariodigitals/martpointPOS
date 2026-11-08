-- Central SMS/Email credit billing foundation. Existing business_deployments and
-- the Central (fleet_id, store_id) operational wallets remain unchanged.
CREATE TABLE IF NOT EXISTS central_installation_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  fleet_install_id BIGINT NOT NULL,
  store_id BIGINT NOT NULL,
  install_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fleet_install_id, store_id)
);
CREATE INDEX IF NOT EXISTS central_installation_mappings_business_idx ON central_installation_mappings(business_id);

CREATE TABLE IF NOT EXISTS central_credit_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE CHECK (channel IN ('sms','email')),
  product_code TEXT NOT NULL UNIQUE,
  price_per_credit_kobo BIGINT NOT NULL CHECK (price_per_credit_kobo > 0),
  minimum_topup_kobo BIGINT NOT NULL CHECK (minimum_topup_kobo >= 0),
  tax_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_bps BETWEEN 0 AND 10000),
  bundles JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_version TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS central_billing_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id),
  mapping_id UUID NOT NULL REFERENCES central_installation_mappings(id),
  fleet_install_id BIGINT NOT NULL,
  store_id BIGINT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
  credit_units BIGINT NOT NULL CHECK (credit_units > 0),
  invoice_id UUID REFERENCES invoices(id),
  invoice_item_id UUID REFERENCES invoice_items(id),
  payment_id UUID REFERENCES payments(id),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','CONFIRMED','FAILED','REVERSED','REFUNDED')),
  allocation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (allocation_status IN ('PENDING','ALLOCATED','FAILED')),
  accounting_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (accounting_status IN ('PENDING','POSTED','FAILED')),
  fulfillment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_status IN ('PENDING','SENT','ACKNOWLEDGED','FAILED')),
  provider_reference TEXT UNIQUE,
  manual_payment_key TEXT UNIQUE,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS central_billing_intents_recovery_idx ON central_billing_intents(payment_status, accounting_status, fulfillment_status);

CREATE TABLE IF NOT EXISTS central_billing_fulfillment_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL UNIQUE REFERENCES central_billing_intents(id) ON DELETE CASCADE,
  event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','ACKNOWLEDGED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS central_billing_intent_id UUID UNIQUE REFERENCES central_billing_intents(id);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS central_billing_intent_id UUID REFERENCES central_billing_intents(id);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_central_billing_intent_unique ON receipts(central_billing_intent_id) WHERE central_billing_intent_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM receipts WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS receipts_payment_id_unique ON receipts(payment_id) WHERE payment_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_item_type_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_item_type_check
  CHECK (item_type IN ('PRODUCT','PLAN','ADDON','SERVICE','CUSTOM','CREDIT'));

ALTER TABLE central_installation_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_credit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_billing_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_billing_fulfillment_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_central_installation_mappings_all ON central_installation_mappings;
CREATE POLICY sr_central_installation_mappings_all ON central_installation_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_central_credit_products_all ON central_credit_products;
CREATE POLICY sr_central_credit_products_all ON central_credit_products FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_central_billing_intents_all ON central_billing_intents;
CREATE POLICY sr_central_billing_intents_all ON central_billing_intents FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_central_billing_fulfillment_outbox_all ON central_billing_fulfillment_outbox;
CREATE POLICY sr_central_billing_fulfillment_outbox_all ON central_billing_fulfillment_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION central_create_credit_invoice(
  p_idempotency_key TEXT, p_payload_hash TEXT, p_fleet_install_id BIGINT,
  p_store_id BIGINT, p_install_url TEXT, p_channel TEXT, p_credit_units BIGINT,
  p_package_id BIGINT, p_amount_kobo BIGINT, p_tax_kobo BIGINT
) RETURNS TABLE(intent_id UUID, invoice_id UUID, invoice_item_id UUID, invoice_number TEXT,
                business_id UUID, amount_kobo BIGINT, tax_kobo BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m central_installation_mappings%ROWTYPE; p central_credit_products%ROWTYPE;
        i central_billing_intents%ROWTYPE; v_invoice UUID; v_item UUID; v_num TEXT;
        v_sub NUMERIC(14,2); v_tax NUMERIC(14,2); v_total NUMERIC(14,2);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key)::BIGINT);
  SELECT * INTO m FROM central_installation_mappings
   WHERE fleet_install_id=p_fleet_install_id AND store_id=p_store_id
     AND install_url=p_install_url AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active installation mapping not found'; END IF;
  SELECT * INTO p FROM central_credit_products WHERE channel=p_channel AND active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active imported credit product not found'; END IF;
  SELECT * INTO i FROM central_billing_intents WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF i.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'Idempotency key payload conflict'; END IF;
    RETURN QUERY SELECT i.id,i.invoice_id,i.invoice_item_id,inv.invoice_number,i.business_id,
      (inv.total_amount*100)::BIGINT,(inv.tax_amount*100)::BIGINT FROM invoices inv WHERE inv.id=i.invoice_id;
    RETURN;
  END IF;
  IF p_credit_units < 1 OR p_amount_kobo < 1 OR p_tax_kobo < 0 OR p_tax_kobo >= p_amount_kobo THEN
    RAISE EXCEPTION 'Invalid credit invoice amounts';
  END IF;
  IF round((p_amount_kobo-p_tax_kobo)::NUMERIC*p.tax_bps/10000)::BIGINT <> p_tax_kobo THEN
    RAISE EXCEPTION 'Tax does not match imported catalogue';
  END IF;
  IF p_package_id > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p.bundles) AS b
       WHERE (b->>'id')::BIGINT=p_package_id AND COALESCE((b->>'enabled')::BOOLEAN,true)
         AND (b->>'amount_kobo')::BIGINT=p_amount_kobo-p_tax_kobo
         AND (b->>'credit_units')::BIGINT=p_credit_units
    ) THEN RAISE EXCEPTION 'Bundle does not match imported catalogue'; END IF;
  ELSIF p_credit_units <> floor((p_amount_kobo-p_tax_kobo)::NUMERIC/p.price_per_credit_kobo)::BIGINT
     OR p_amount_kobo-p_tax_kobo < p.minimum_topup_kobo THEN
    RAISE EXCEPTION 'Credit price or minimum does not match imported catalogue';
  END IF;
  v_total := p_amount_kobo::NUMERIC/100;
  v_tax := p_tax_kobo::NUMERIC/100;
  v_sub := v_total-v_tax;
  v_num := next_invoice_number(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  INSERT INTO invoices(invoice_number,business_id,currency,issue_date,due_date,subtotal,tax_amount,total_amount,balance_due,status,notes_public,created_at,updated_at)
  VALUES(v_num,m.business_id,'NGN',CURRENT_DATE,CURRENT_DATE,v_sub,v_tax,v_total,v_total,'ISSUED','Central SMS/Email credit purchase',now(),now()) RETURNING id INTO v_invoice;
  INSERT INTO invoice_items(invoice_id,item_type,reference_id,description,quantity,unit_price,discount,tax,line_total)
  VALUES(v_invoice,'CREDIT',p.id,p_channel||' credits ('||p_credit_units||' units)',1,v_sub,0,v_tax,v_total) RETURNING id INTO v_item;
  INSERT INTO central_billing_intents(idempotency_key,payload_hash,business_id,mapping_id,fleet_install_id,store_id,channel,credit_units,invoice_id,invoice_item_id)
  VALUES(p_idempotency_key,p_payload_hash,m.business_id,m.id,p_fleet_install_id,p_store_id,p_channel,p_credit_units,v_invoice,v_item) RETURNING * INTO i;
  RETURN QUERY SELECT i.id,v_invoice,v_item,v_num,m.business_id,p_amount_kobo,p_tax_kobo;
END $$;
REVOKE ALL ON FUNCTION central_create_credit_invoice(TEXT,TEXT,BIGINT,BIGINT,TEXT,TEXT,BIGINT,BIGINT,BIGINT,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION central_create_credit_invoice(TEXT,TEXT,BIGINT,BIGINT,TEXT,TEXT,BIGINT,BIGINT,BIGINT,BIGINT) TO service_role;
