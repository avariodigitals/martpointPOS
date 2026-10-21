-- Azera admin read state and safe starter knowledge.
-- The seed is inserted for every existing business so the public business and
-- any retail-app business can answer immediately after migrations are applied.

ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS azera_messages_unread_idx
  ON azera_messages (conversation_id, read_at)
  WHERE direction = 'inbound' AND read_at IS NULL;

WITH seed(title, content, keywords, category, audience, source_url, status, sort_order) AS (
  VALUES
    (
      'Welcome to MartPoint Assist',
      'MartPoint Assist can help with product information, demos, pricing questions, PayPlan, setup guidance and first-line support. For a greeting, ask whether the visitor needs Sales, technical help or guidance using MartPoint.',
      ARRAY['hello', 'hi', 'hey', 'help', 'assist']::text[],
      'General', 'all', 'https://www.martpoint.com.ng/help-centre', 'published', 10
    ),
    (
      'What is MartPoint?',
      'MartPoint is business software for African retailers and service businesses. It combines point of sale, products and inventory, customers, sales, reporting and online-store capabilities, with additional tools available for the business type and plan.',
      ARRAY['martpoint', 'pos', 'software', 'retail', 'business', 'inventory']::text[],
      'Product', 'prospect', 'https://www.martpoint.com.ng/features', 'published', 20
    ),
    (
      'How much does MartPoint cost?',
      'MartPoint pricing depends on the business type, users, branches, modules and implementation needs. There is no single price that is safe to quote for every business. Invite the visitor to book a personalised demo or ask Sales for a current quotation.',
      ARRAY['price', 'pricing', 'cost', 'plan', 'subscription', 'quote', 'how much']::text[],
      'Sales', 'prospect', 'https://www.martpoint.com.ng/pricing', 'published', 30
    ),
    (
      'How do I book a MartPoint demo?',
      'A visitor can book a personalised demo at https://www.martpoint.com.ng/book-demo. The demo is used to understand the business, recommend the relevant MartPoint setup and confirm the current commercial proposal.',
      ARRAY['demo', 'book', 'booking', 'demonstration', 'meeting', 'sales']::text[],
      'Sales', 'prospect', 'https://www.martpoint.com.ng/book-demo', 'published', 40
    ),
    (
      'What is MartPoint PayPlan?',
      'PayPlan helps a business offer customers instalment payments by recording deposits, tracking the balance and collecting what remains. The exact availability and commercial terms depend on the enabled plan and business setup; Sales should confirm current terms.',
      ARRAY['payplan', 'pay plan', 'installment', 'instalment', 'deposit', 'balance']::text[],
      'Product', 'all', 'https://www.martpoint.com.ng/martpoint-retail', 'published', 50
    ),
    (
      'Which businesses can use MartPoint?',
      'MartPoint supports many African business types, including general retail, supermarkets, pharmacies, restaurants, fashion, frozen foods, garden, building materials, physiotherapy and other product or service businesses. The demo should be tailored to the visitor’s industry.',
      ARRAY['industry', 'pharmacy', 'restaurant', 'fashion', 'frozen', 'garden', 'building', 'physiotherapy', 'business type']::text[],
      'Industries', 'prospect', 'https://www.martpoint.com.ng/industries', 'published', 60
    ),
    (
      'Does MartPoint work when the internet is unavailable?',
      'MartPoint includes offline-first workflows for supported sales operations. The exact offline coverage and synchronisation behaviour depend on the product setup, so a specialist should confirm the requirements for the business and devices.',
      ARRAY['offline', 'internet', 'internet down', 'sync', 'no network', 'connection']::text[],
      'Product', 'all', 'https://www.martpoint.com.ng/features', 'published', 70
    ),
    (
      'I need help with a MartPoint problem',
      'For a technical problem, share the affected screen or workflow and what happened. Do not share passwords, OTPs, API keys, card details or other secrets. If the issue involves lost data, unauthorised access, missing money, a security incident or a serious complaint, ask for a MartPoint specialist immediately.',
      ARRAY['support', 'technical', 'error', 'problem', 'issue', 'broken', 'login', 'security']::text[],
      'Support', 'merchant', 'https://www.martpoint.com.ng/help-centre', 'published', 80
    )
)
INSERT INTO azera_knowledge (business_id, title, content, keywords, category, audience, source_url, status, sort_order)
SELECT b.id, s.title, s.content, s.keywords, s.category, s.audience, s.source_url, s.status, s.sort_order
FROM businesses b
CROSS JOIN seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM azera_knowledge existing
  WHERE existing.business_id = b.id
    AND existing.title = s.title
);
