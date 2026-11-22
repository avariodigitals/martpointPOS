-- Publish the initial AI Ads tiers and include a conservative quota for
-- prompt-generated video. Prices are NGN before tax; tax stays sourced from
-- the Next-owned central credit catalogue and is added at checkout.
--
-- Video unit economics: cap generated clips at 10 seconds / 720p. Budget
-- $1.00 provider cost per clip using an internal FX buffer of NGN 1,450/USD
-- (NGN 1,450 cost), based on Google's published Gemini Omni video rate of
-- about $0.10/second. A NGN 2,700 allocation leaves about 41% after
-- Paystack's 1.5% local fee plus a conservative NGN 100 fixed fee per clip.
-- Monthly tiers add that allocation for their 1/3/8 clip quotas. Annual tiers
-- discount the software portion to 10 months but retain 12 months of video
-- credits, so annual video use is not underpriced by the discount.

UPDATE public.central_addon_products
SET name = plans.name,
    price_kobo = plans.price_kobo,
    tax_bps = COALESCE((SELECT tax_bps FROM public.central_credit_products ORDER BY channel LIMIT 1), 750),
    details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
      'access', 'AI Ads workspace and campaign tools',
      'renewal', 'manual until an explicit recurring mandate is implemented',
      'ad_spend', 'paid directly by the merchant to Meta',
      'entitlements', plans.entitlements
    ),
    source_version = 'migration-199',
    source_hash = repeat('0', 64),
    active = false
FROM (VALUES
  ('ai-ads-monthly', 'AI Ads Starter', 1020000::BIGINT, '{"copy_generations_per_month":20,"ai_images_per_month":2,"video_exports_per_month":2,"ai_video_generations_per_month":1,"media_storage_mb":100}'::jsonb),
  ('ai-ads-annual', 'AI Ads Starter', 10740000::BIGINT, '{"copy_generations_per_month":20,"ai_images_per_month":2,"video_exports_per_month":2,"ai_video_generations_per_month":1,"media_storage_mb":100}'::jsonb),
  ('ai-ads-growth-monthly', 'AI Ads Growth', 2760000::BIGINT, '{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-growth-annual', 'AI Ads Growth', 29220000::BIGINT, '{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-scale-monthly', 'AI Ads Scale', 7110000::BIGINT, '{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb),
  ('ai-ads-scale-annual', 'AI Ads Scale', 75420000::BIGINT, '{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb)
) AS plans(product_code, name, price_kobo, entitlements)
WHERE public.central_addon_products.product_code = plans.product_code
  AND public.central_addon_products.fulfillment_type = 'AI_ADS_SUBSCRIPTION';

-- New tier rows were created disabled by migration 198. This insert/upsert
-- also makes the migration safe if that migration has not yet been applied.
INSERT INTO public.central_addon_products
  (product_code, addon_key, name, fulfillment_type, billing_period, price_kobo,
   tax_bps, details, source_version, source_hash, active)
SELECT plans.product_code, plans.addon_key, plans.name, 'AI_ADS_SUBSCRIPTION',
       plans.billing_period, plans.price_kobo,
       COALESCE((SELECT tax_bps FROM public.central_credit_products ORDER BY channel LIMIT 1), 750),
       jsonb_build_object(
         'access', 'AI Ads workspace and campaign tools',
         'renewal', 'manual until an explicit recurring mandate is implemented',
         'ad_spend', 'paid directly by the merchant to Meta',
         'entitlements', plans.entitlements
       ),
       'migration-199', repeat('0',64), false
FROM (VALUES
  ('ai-ads-growth-monthly','ai_ads_growth','AI Ads Growth','monthly',2760000::BIGINT,'{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-growth-annual','ai_ads_growth','AI Ads Growth','annual',29220000::BIGINT,'{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-scale-monthly','ai_ads_scale','AI Ads Scale','monthly',7110000::BIGINT,'{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb),
  ('ai-ads-scale-annual','ai_ads_scale','AI Ads Scale','annual',75420000::BIGINT,'{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb)
) AS plans(product_code, addon_key, name, billing_period, price_kobo, entitlements)
ON CONFLICT (product_code) DO UPDATE
SET name = EXCLUDED.name,
    price_kobo = EXCLUDED.price_kobo,
    tax_bps = EXCLUDED.tax_bps,
    details = EXCLUDED.details,
    source_version = EXCLUDED.source_version,
    source_hash = EXCLUDED.source_hash,
    active = false;
