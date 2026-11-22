-- Reprice the disabled AI Ads offers to cover current provider video costs.
-- Keep every offer disabled until generation, storage and quota enforcement ship.
UPDATE public.central_addon_products AS product
SET name = plans.name,
    price_kobo = plans.price_kobo,
    source_version = 'migration-200',
    source_hash = repeat('0', 64),
    active = false
FROM (VALUES
  ('ai-ads-monthly', 'AI Ads Starter', 1020000::BIGINT),
  ('ai-ads-annual', 'AI Ads Starter', 10740000::BIGINT),
  ('ai-ads-growth-monthly', 'AI Ads Growth', 2760000::BIGINT),
  ('ai-ads-growth-annual', 'AI Ads Growth', 29220000::BIGINT),
  ('ai-ads-scale-monthly', 'AI Ads Scale', 7110000::BIGINT),
  ('ai-ads-scale-annual', 'AI Ads Scale', 75420000::BIGINT)
) AS plans(product_code, name, price_kobo)
WHERE product.product_code = plans.product_code
  AND product.fulfillment_type = 'AI_ADS_SUBSCRIPTION';
