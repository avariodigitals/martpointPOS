-- General purpose SMS campaign templates for leads, businesses and partners.
-- The migration is safe to run again and leaves any edited template untouched.
INSERT INTO public.communication_templates (name, channel, subject, body)
SELECT x.name, 'sms', '', x.body
FROM (VALUES
  ('Product announcement', 'Hi {{name}}, {{product}} has an update for {{business}}. See what is new and let us know if you would like a walkthrough. Reply STOP to opt out.'),
  ('Special offer', 'Hi {{name}}, we have a new {{product}} offer for {{business}}. Reply to this message and our team will share the details. Reply STOP to opt out.'),
  ('Event invitation', 'Hi {{name}}, you are invited to a {{product}} session for businesses like {{business}}. Reply YES and we will send the event details. Reply STOP to opt out.'),
  ('Event reminder', 'Hi {{name}}, a quick reminder about your upcoming {{product}} session. We look forward to seeing {{business}} there. Reply STOP to opt out.'),
  ('Demo reminder', 'Hi {{name}}, this is a reminder about your {{product}} demo for {{business}}. Reply if you need to change the time. Reply STOP to opt out.'),
  ('Partner update', 'Hi {{name}}, there is a new {{product}} update for our partners. Reply if you would like the details or need support. Reply STOP to opt out.'),
  ('Service announcement', 'Hi {{name}}, we have an important {{product}} update for {{business}}. Please contact our team if you need help. Reply STOP to opt out.'),
  ('Reconnect with a contact', 'Hi {{name}}, checking in from MartPoint. Is {{business}} still exploring {{product}}? Reply and our team can help with next steps. Reply STOP to opt out.')
) AS x(name, body)
WHERE NOT EXISTS (
  SELECT 1 FROM public.communication_templates t
  WHERE t.channel = 'sms' AND t.name = x.name
);

NOTIFY pgrst, 'reload schema';
