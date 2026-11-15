-- Pre-order carousel variants are demonstration listings with test inventory only.
INSERT INTO regions(slug,name) VALUES
 ('uk','United Kingdom'),('india','India'),('latin-america','Latin America'),('brazil','Brazil')
ON CONFLICT(slug) DO NOTHING;

WITH seed(slug,name,platform,cover,sales_count) AS (VALUES
 ('grand-theft-auto-vi-ultimate-xbox-uk','Grand Theft Auto VI: Ultimate Edition (Xbox Series X|S) XBOX LIVE Key UNITED KINGDOM','xbox','/reference/products/product-4.webp',20000),
 ('grand-theft-auto-vi-ps5-india','Grand Theft Auto VI (PS5) PSN Key INDIA','psn','/reference/products/product-3.webp',19500),
 ('grand-theft-auto-vi-xbox-latam','Grand Theft Auto VI (Xbox Series X|S) XBOX LIVE Key LATIN AMERICA','xbox','/reference/products/product-3.webp',19000),
 ('grand-theft-auto-vi-xbox-brazil','Grand Theft Auto VI (Xbox Series X|S) XBOX LIVE Key BRAZIL','xbox','/reference/products/product-3.webp',18500),
 ('grand-theft-auto-vi-ultimate-xbox-india','Grand Theft Auto VI: Ultimate Edition (Xbox Series X|S) XBOX LIVE Key INDIA','xbox','/reference/products/product-4.webp',18000)
)
INSERT INTO products(slug,name,description,cover_url,developer,genres,platform_id,categories,product_type,sales_count)
SELECT seed.slug,seed.name,
 'Demo pre-order listing. Compare simulated seller offers for the named platform and activation region. Purchases deliver test keys only, not a playable game license or a real pre-order reservation.',
 seed.cover,'Rockstar Games',ARRAY['Action','Adventure'],pl.id,ARRAY['games','pre-orders',seed.platform],'games',seed.sales_count
FROM seed JOIN platforms pl ON pl.slug=seed.platform;

WITH seed(slug,region,price) AS (VALUES
 ('grand-theft-auto-vi-ultimate-xbox-uk','uk',8244),
 ('grand-theft-auto-vi-ps5-india','india',7900),
 ('grand-theft-auto-vi-xbox-latam','latin-america',6479),
 ('grand-theft-auto-vi-xbox-brazil','brazil',6499),
 ('grand-theft-auto-vi-ultimate-xbox-india','india',8299)
), added AS (
 INSERT INTO offers(product_id,seller_id,region_id,price_cents,currency)
 SELECT p.id,s.id,r.id,
  seed.price+CASE s.name WHEN 'KeyStation' THEN 170 WHEN 'Pixel Market' THEN 340 ELSE 0 END,
  'EUR'
 FROM seed JOIN products p ON p.slug=seed.slug JOIN regions r ON r.slug=seed.region CROSS JOIN sellers s
 WHERE s.name IN ('GameNest','KeyStation','Pixel Market')
 RETURNING id
)
INSERT INTO key_inventory(offer_id,key_value)
SELECT added.id,'TEST-UPCOMING-'||added.id||'-'||n FROM added CROSS JOIN generate_series(1,15)n;

UPDATE home_blocks SET type='upcoming',title='Upcoming games' WHERE type='deals';
