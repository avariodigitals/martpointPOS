-- Add two optional AI Ads capacity tiers without changing the existing Starter prices.
UPDATE public.central_addon_products
SET name = 'AI Ads Starter'
WHERE fulfillment_type = 'AI_ADS_SUBSCRIPTION'
  AND addon_key = 'ai_ads'
  AND product_code IN ('ai-ads-monthly', 'ai-ads-annual');

INSERT INTO public.central_addon_products
  (product_code, addon_key, name, fulfillment_type, billing_period, price_kobo,
   tax_bps, details, source_version, source_hash, active)
SELECT plans.product_code, plans.addon_key, plans.name, 'AI_ADS_SUBSCRIPTION', plans.billing_period, 0,
       COALESCE((SELECT tax_bps FROM public.central_credit_products ORDER BY channel LIMIT 1), 0),
       jsonb_build_object(
         'access', 'AI Ads workspace and campaign tools',
         'renewal', 'manual until an explicit recurring mandate is implemented',
         'ad_spend', 'paid directly by the merchant to Meta',
         'entitlements', plans.entitlements
       ),
       'migration-198', repeat('0',64), false
FROM (VALUES
  ('ai-ads-growth-monthly','ai_ads_growth','AI Ads Growth','monthly','{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-growth-annual','ai_ads_growth','AI Ads Growth','annual','{"copy_generations_per_month":60,"ai_images_per_month":8,"video_exports_per_month":10,"ai_video_generations_per_month":3,"media_storage_mb":500}'::jsonb),
  ('ai-ads-scale-monthly','ai_ads_scale','AI Ads Scale','monthly','{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb),
  ('ai-ads-scale-annual','ai_ads_scale','AI Ads Scale','annual','{"copy_generations_per_month":200,"ai_images_per_month":25,"video_exports_per_month":40,"ai_video_generations_per_month":8,"media_storage_mb":2048}'::jsonb)
) AS plans(product_code,addon_key,name,billing_period,entitlements)
ON CONFLICT (product_code) DO NOTHING;
