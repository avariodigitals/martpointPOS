-- Keep the actor on in-app notifications so the person who performed an
-- action does not receive their own echo, while other users still do.
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS actor_admin_user_id UUID;

ALTER TABLE partner_notifications
  ADD COLUMN IF NOT EXISTS actor_partner_user_id UUID;

ALTER TABLE creator_notifications
  ADD COLUMN IF NOT EXISTS actor_creator_id UUID;

CREATE INDEX IF NOT EXISTS admin_notifications_actor_idx
  ON admin_notifications (admin_user_id, actor_admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS partner_notifications_actor_idx
  ON partner_notifications (partner_id, actor_partner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creator_notifications_actor_idx
  ON creator_notifications (creator_id, actor_creator_id, created_at DESC);
