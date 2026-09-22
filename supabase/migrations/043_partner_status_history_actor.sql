-- Partner action trail: record WHO performed each action and WHAT kind of
-- event it was (status change, internal note, document review, etc).
ALTER TABLE partner_status_history ADD COLUMN IF NOT EXISTS changed_by_name TEXT;
ALTER TABLE partner_status_history ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'STATUS_CHANGE';

-- Backfill actor names for rows recorded before changed_by_name existed
UPDATE partner_status_history h
SET changed_by_name = u.name
FROM users u
WHERE u.id = h.changed_by AND h.changed_by_name IS NULL;
