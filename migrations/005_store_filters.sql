ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'games';
ALTER TABLE products ADD COLUMN operating_systems TEXT[] NOT NULL DEFAULT '{}';
UPDATE products SET product_type='gaming-ecards' WHERE categories && ARRAY['gaming-ecards','steam-gift-cards'];
UPDATE products SET operating_systems=ARRAY['windows'] WHERE platform_id IN (SELECT id FROM platforms WHERE slug IN ('steam','epic','ea-app','official')) AND product_type='games';
