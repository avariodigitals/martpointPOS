-- 129_creator_challenge_metric_expectations.sql
-- Publish explicit performance expectations for the Pilot 001 awards.
-- These values are shown to creators and enforced by the award candidate engine.
-- Do not amend a live/frozen challenge silently; admins must use the versioned
-- amendment flow after activation.

UPDATE creator_challenge_awards AS a
SET scoring_config = a.scoring_config || CASE a.award_type
  WHEN 'OVERALL' THEN '{"judgeWeight":60,"performanceWeight":40,"minApprovedSubmissions":1}'::jsonb
  WHEN 'CONVERSION' THEN '{"minQualifiedOutcomes":1,"minQualifiedLeads":1}'::jsonb
  WHEN 'REACH' THEN '{"minViews":1000,"measurementWindowDays":7}'::jsonb
  WHEN 'CREATIVE' THEN '{"judgeOnly":true}'::jsonb
  WHEN 'RISING' THEN '{"minViews":500,"measurementWindowDays":7}'::jsonb
  ELSE '{}'::jsonb
END
WHERE a.challenge_id IN (
  SELECT id FROM creator_challenges
  WHERE slug = 'creator-challenge-pilot-001'
    AND rules_frozen_at IS NULL
);

UPDATE creator_challenges
SET scoring_config = scoring_config || '{"metricWindowDays":7,"maxCashAwardsPerCreator":1,"integrityReview":{"enabled":true,"matureAfterDays":5}}'::jsonb,
    updated_at = now()
WHERE slug = 'creator-challenge-pilot-001'
  AND rules_frozen_at IS NULL;
