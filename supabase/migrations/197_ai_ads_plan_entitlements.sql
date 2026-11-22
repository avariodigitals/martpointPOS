-- Persist the initial AI Ads included allowances in the Next-owned catalogue.
-- Preserve administrator-edited entitlement objects when this migration runs.
UPDATE public.central_addon_products
SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
  'entitlements', jsonb_build_object(
    'copy_generations_per_month', 20,
    'ai_images_per_month', 2,
    'video_exports_per_month', 2,
    'media_storage_mb', 100
  ) || CASE WHEN jsonb_typeof(details->'entitlements') = 'object' THEN details->'entitlements' ELSE '{}'::jsonb END
)
WHERE fulfillment_type = 'AI_ADS_SUBSCRIPTION'
  AND product_code IN ('ai-ads-monthly', 'ai-ads-annual');
