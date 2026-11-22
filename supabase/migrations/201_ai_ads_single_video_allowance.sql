-- All AI-generated clips have provider cost, whether prompted from scratch or
-- made from merchant media. Keep one plan allowance for both creation paths.
-- The separate export field remains for backward compatibility and is set to
-- zero so it cannot be sold as free AI video capacity.
UPDATE public.central_addon_products
SET details = jsonb_set(
      COALESCE(details, '{}'::jsonb),
      '{entitlements}',
      COALESCE(details->'entitlements', '{}'::jsonb)
        || jsonb_build_object('video_exports_per_month', 0)
    ),
    source_version = 'migration-201',
    source_hash = repeat('0', 64),
    active = false
WHERE fulfillment_type = 'AI_ADS_SUBSCRIPTION'
  AND product_code IN (
    'ai-ads-monthly', 'ai-ads-annual',
    'ai-ads-growth-monthly', 'ai-ads-growth-annual',
    'ai-ads-scale-monthly', 'ai-ads-scale-annual'
  );
