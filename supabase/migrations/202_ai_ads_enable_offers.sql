-- Re-enable the published AI Ads offers after migration 201 deliberately
-- disabled them during the creative pipeline rollout. This changes only the
-- catalogue active flag and leaves prices, tax, and entitlements untouched.
UPDATE public.central_addon_products
SET active = true,
    source_version = 'migration-202',
    source_hash = repeat('0', 64)
WHERE fulfillment_type = 'AI_ADS_SUBSCRIPTION'
  AND product_code IN (
    'ai-ads-monthly', 'ai-ads-annual',
    'ai-ads-growth-monthly', 'ai-ads-growth-annual',
    'ai-ads-scale-monthly', 'ai-ads-scale-annual'
  );
