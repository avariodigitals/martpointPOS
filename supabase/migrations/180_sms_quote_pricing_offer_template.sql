-- Follow up on a shared quote and invite the lead to discuss a suitable offer.
INSERT INTO public.communication_templates (name, channel, subject, body)
SELECT 'Quote follow-up · pricing & offer', 'sms', '',
       'Hi {{name}}, checking on the {{product}} quote for {{business}}. Is pricing the main concern? Reply PRICE and we will discuss an offer that fits. Reply STOP to opt out.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.communication_templates
  WHERE channel = 'sms' AND name = 'Quote follow-up · pricing & offer'
);

NOTIFY pgrst, 'reload schema';
