-- Store independently configurable grade thresholds, minimum durations and
-- assessment windows for each approved Partner Type. Existing numeric values
-- are copied into each track so this schema change does not alter thresholds.
UPDATE public.partner_grading_policies p
SET criteria = COALESCE(p.criteria, '{}'::jsonb) || jsonb_build_object(
  'trackCriteria', COALESCE(p.criteria->'trackCriteria', '{}'::jsonb) || jsonb_build_object(
    'REFERRAL', COALESCE(p.criteria->'trackCriteria'->'REFERRAL', jsonb_build_object('silverOutcomes', p.silver_outcomes, 'goldOutcomes', p.gold_outcomes, 'platinumOutcomes', p.platinum_outcomes, 'silverMinDays', p.silver_min_days, 'goldMinDays', p.gold_min_days, 'platinumMinDays', p.platinum_min_days, 'assessmentWindowDays', p.rolling_window_days)),
    'CHANNEL', COALESCE(p.criteria->'trackCriteria'->'CHANNEL', jsonb_build_object('silverOutcomes', p.silver_outcomes, 'goldOutcomes', p.gold_outcomes, 'platinumOutcomes', p.platinum_outcomes, 'silverMinDays', p.silver_min_days, 'goldMinDays', p.gold_min_days, 'platinumMinDays', p.platinum_min_days, 'assessmentWindowDays', p.rolling_window_days)),
    'IMPLEMENTATION', COALESCE(p.criteria->'trackCriteria'->'IMPLEMENTATION', jsonb_build_object('silverOutcomes', p.silver_outcomes, 'goldOutcomes', p.gold_outcomes, 'platinumOutcomes', p.platinum_outcomes, 'silverMinDays', p.silver_min_days, 'goldMinDays', p.gold_min_days, 'platinumMinDays', p.platinum_min_days, 'assessmentWindowDays', p.rolling_window_days)),
    'TECHNOLOGY', COALESCE(p.criteria->'trackCriteria'->'TECHNOLOGY', jsonb_build_object('silverOutcomes', p.silver_outcomes, 'goldOutcomes', p.gold_outcomes, 'platinumOutcomes', p.platinum_outcomes, 'silverMinDays', p.silver_min_days, 'goldMinDays', p.gold_min_days, 'platinumMinDays', p.platinum_min_days, 'assessmentWindowDays', p.rolling_window_days)),
    'PAYMENT', COALESCE(p.criteria->'trackCriteria'->'PAYMENT', jsonb_build_object('silverOutcomes', p.silver_outcomes, 'goldOutcomes', p.gold_outcomes, 'platinumOutcomes', p.platinum_outcomes, 'silverMinDays', p.silver_min_days, 'goldMinDays', p.gold_min_days, 'platinumMinDays', p.platinum_min_days, 'assessmentWindowDays', p.rolling_window_days))
  )
);

NOTIFY pgrst, 'reload schema';
