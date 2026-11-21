-- AI Ads is a recurring access add-on billed through the existing Central
-- invoice, Paystack verification, finance ledger, and fulfilment outbox.
ALTER TABLE public.central_addon_products
  DROP CONSTRAINT IF EXISTS central_addon_products_fulfillment_type_check;
ALTER TABLE public.central_addon_products
  ADD CONSTRAINT central_addon_products_fulfillment_type_check
  CHECK (fulfillment_type IN ('AUTOMATION_PLAN', 'AI_ADS_SUBSCRIPTION'));

INSERT INTO public.central_addon_products
  (product_code, addon_key, name, fulfillment_type, billing_period, price_kobo,
   tax_bps, details, source_version, source_hash, active)
SELECT offers.product_code, 'ai_ads', 'MartPoint AI Ads', 'AI_ADS_SUBSCRIPTION', offers.billing_period, 0,
       COALESCE((SELECT tax_bps FROM public.central_credit_products ORDER BY channel LIMIT 1), 0),
       '{"access":"AI Ads workspace and campaign tools","renewal":"manual until an explicit recurring mandate is implemented","ad_spend":"paid directly by the merchant to Meta"}'::jsonb,
       'migration-196', repeat('0',64), false
FROM (VALUES ('ai-ads-monthly','monthly'),('ai-ads-annual','annual')) AS offers(product_code,billing_period)
ON CONFLICT (product_code) DO NOTHING;

-- Keep canonical invoices product-neutral as this RPC now supports both
-- Automation and AI Ads subscriptions.
CREATE OR REPLACE FUNCTION public.central_create_addon_invoice(
  p_idempotency_key TEXT, p_payload_hash TEXT, p_fleet_install_id BIGINT,
  p_store_id BIGINT, p_install_url TEXT, p_product_code TEXT, p_amount_kobo BIGINT,
  p_tax_kobo BIGINT
) RETURNS TABLE(intent_id UUID, invoice_id UUID, invoice_item_id UUID, invoice_number TEXT,
                business_id UUID, amount_kobo BIGINT, tax_kobo BIGINT, addon_key TEXT, billing_period TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m central_installation_mappings%ROWTYPE; p central_addon_products%ROWTYPE;
        i central_billing_intents%ROWTYPE; v_invoice UUID; v_item UUID; v_num TEXT;
        v_sub NUMERIC(14,2); v_tax NUMERIC(14,2); v_total NUMERIC(14,2);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key)::BIGINT);
  SELECT * INTO m FROM central_installation_mappings
   WHERE fleet_install_id=p_fleet_install_id AND store_id=p_store_id AND install_url=p_install_url AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active installation mapping not found'; END IF;
  SELECT * INTO p FROM central_addon_products WHERE product_code=p_product_code AND active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active imported add-on product not found'; END IF;
  SELECT * INTO i FROM central_billing_intents WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF i.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'Idempotency key payload conflict'; END IF;
    RETURN QUERY SELECT i.id,i.invoice_id,i.invoice_item_id,inv.invoice_number,i.business_id,
      (inv.total_amount*100)::BIGINT,(inv.tax_amount*100)::BIGINT,i.addon_key,i.billing_period FROM invoices inv WHERE inv.id=i.invoice_id;
    RETURN;
  END IF;
  IF p_amount_kobo <= 0 OR p_tax_kobo < 0 OR p_tax_kobo >= p_amount_kobo
     OR round((p_amount_kobo-p_tax_kobo)::NUMERIC*p.tax_bps/10000)::BIGINT <> p_tax_kobo
     OR p_amount_kobo-p_tax_kobo <> p.price_kobo THEN RAISE EXCEPTION 'Amount or tax does not match imported add-on catalogue'; END IF;
  v_total := p_amount_kobo::NUMERIC/100; v_tax := p_tax_kobo::NUMERIC/100; v_sub := v_total-v_tax;
  v_num := next_invoice_number(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  INSERT INTO invoices(invoice_number,business_id,currency,issue_date,due_date,subtotal,tax_amount,total_amount,balance_due,status,notes_public,created_at,updated_at)
  VALUES(v_num,m.business_id,'NGN',CURRENT_DATE,CURRENT_DATE,v_sub,v_tax,v_total,v_total,'ISSUED','MartPoint paid add-on purchase',now(),now()) RETURNING id INTO v_invoice;
  INSERT INTO invoice_items(invoice_id,item_type,reference_id,description,quantity,unit_price,discount,tax,line_total)
  VALUES(v_invoice,'ADDON',p.id,p.name||' ('||p.billing_period||')',1,v_sub,0,v_tax,v_total) RETURNING id INTO v_item;
  INSERT INTO central_billing_intents(idempotency_key,payload_hash,business_id,mapping_id,fleet_install_id,store_id,channel,credit_units,
    product_type,addon_product_id,addon_key,billing_period,product_details,invoice_id,invoice_item_id)
  VALUES(p_idempotency_key,p_payload_hash,m.business_id,m.id,p_fleet_install_id,p_store_id,NULL,0,'ADDON',p.id,p.addon_key,p.billing_period,p.details,v_invoice,v_item)
  RETURNING * INTO i;
  RETURN QUERY SELECT i.id,v_invoice,v_item,v_num,m.business_id,p_amount_kobo,p_tax_kobo,p.addon_key,p.billing_period;
END $$;
REVOKE ALL ON FUNCTION public.central_create_addon_invoice(TEXT,TEXT,BIGINT,BIGINT,TEXT,TEXT,BIGINT,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.central_create_addon_invoice(TEXT,TEXT,BIGINT,BIGINT,TEXT,TEXT,BIGINT,BIGINT) TO service_role;
