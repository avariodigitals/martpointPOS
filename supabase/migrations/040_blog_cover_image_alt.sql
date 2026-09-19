-- Alt text for blog cover images (SEO/accessibility)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;
