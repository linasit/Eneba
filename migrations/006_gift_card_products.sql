-- Reference gift-card listings are simulated inventory, with test keys only.
INSERT INTO platforms(slug,name) VALUES ('spotify','Spotify') ON CONFLICT(slug) DO NOTHING;
INSERT INTO regions(slug,name) VALUES ('brazil','Brazil'),('turkey','Turkey') ON CONFLICT(slug) DO NOTHING;
WITH seed(slug,name,platform,region,price,old_price,kind,position) AS (VALUES
 ('spotify-month-brazil','Spotify Premium 1 Month Key BRAZIL','spotify','brazil',490,NULL::int,'subscription',0),
 ('psn-card-10-usd','PlayStation Network Card 10 USD (USA) PSN Key UNITED STATES','psn','us',879,905,'gaming-ecards',1),
 ('psn-card-50-usd','PlayStation Network Card 50 USD (USA) PSN Key UNITED STATES','psn','us',4345,4525,'gaming-ecards',3),
 ('psn-card-25-usd','PlayStation Network Card 25 USD (USA) PSN Key UNITED STATES','psn','us',2204,2263,'gaming-ecards',4),
 ('xbox-card-25-try','Xbox Live Gift Card 25 TRY Xbox Live Key TURKEY','xbox','turkey',315,NULL::int,'gaming-ecards',5)
)
INSERT INTO products(slug,name,description,cover_url,developer,platform_id,categories,product_type,sales_count)
SELECT seed.slug,seed.name,'Demo gift-card listing. Simulated payments deliver test keys only. These keys cannot be redeemed for credit or a subscription.',
 '/reference/gift-cards/'||seed.slug||'.jpg','Digital gift card',pl.id,ARRAY['gaming-ecards',seed.platform],seed.kind,13000-seed.position*100
FROM seed JOIN platforms pl ON pl.slug=seed.platform;

INSERT INTO home_product_groups(group_slug,product_id,position)
SELECT 'gift-cards',p.id,s.position FROM (VALUES
 ('spotify-month-brazil',0),('psn-card-10-usd',1),('psn-card-100-usd',2),('psn-card-50-usd',3),('psn-card-25-usd',4),('xbox-card-25-try',5),('psn-card-100-gbp',6)
) s(slug,position) JOIN products p ON p.slug=s.slug;

WITH seed(slug,region,price,old_price) AS (VALUES
 ('spotify-month-brazil','brazil',490,NULL::int),('psn-card-10-usd','us',879,905),
 ('psn-card-50-usd','us',4345,4525),('psn-card-25-usd','us',2204,2263),('xbox-card-25-try','turkey',315,NULL::int)
), added AS (
 INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents)
 SELECT p.id,s.id,r.id,seed.price+CASE s.name WHEN 'KeyStation' THEN ceil(seed.price*.02)::int WHEN 'Pixel Market' THEN ceil(seed.price*.04)::int ELSE 0 END,seed.old_price
 FROM seed JOIN products p ON p.slug=seed.slug JOIN regions r ON r.slug=seed.region CROSS JOIN sellers s
 WHERE s.name IN ('GameNest','KeyStation','Pixel Market') RETURNING id
)
INSERT INTO key_inventory(offer_id,key_value)
SELECT added.id,'TEST-GIFT-'||added.id||'-'||n FROM added CROSS JOIN generate_series(1,15)n;
