-- Let approval rules cover ordinary invoice edits and deletion requests.
INSERT INTO approval_policies(action_key, label, enabled, approver_roles)
VALUES
  ('finance.invoice.update', 'Change an invoice', true, ARRAY['Admin','Finance']::TEXT[]),
  ('finance.invoice.delete', 'Delete an invoice', true, ARRAY['Admin','Finance']::TEXT[]),
  ('finance.payment.record', 'Record a payment', true, ARRAY['Admin','Finance']::TEXT[])
ON CONFLICT (action_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
