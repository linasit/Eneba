INSERT INTO platforms (slug,name) VALUES
 ('steam','Steam'),('xbox','Xbox'),('playstation','PlayStation'),
 ('nintendo','Nintendo'),('epic','Epic Games'),('ea-app','EA app');
INSERT INTO regions (slug,name) VALUES
 ('global','Global'),('europe','Europe'),('north-america','North America'),('row','Rest of World');
INSERT INTO home_blocks (type,title,position) VALUES
 ('banner','Featured',1),('best_sellers','Best sellers',2),('deals','Hot deals',3);

INSERT INTO sellers (name,rating,sales) VALUES ('GameNest',4.98,32841),('KeyStation',4.87,18702),('Pixel Market',4.93,24120);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('elden-ring','ELDEN RING','Experience ELDEN RING and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_600x900_2x.jpg','FromSoftware',ARRAY['Dark fantasy','Open world'],'2023-02-10',1,9800);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (1,1,1,2899,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (1,2,2,3069,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (1,3,1,3239,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('cyberpunk-2077','Cyberpunk 2077','Experience Cyberpunk 2077 and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900_2x.jpg','CD PROJEKT RED',ARRAY['RPG','Open world'],'2023-02-10',1,9200);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (2,1,1,1599,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (2,2,2,1769,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (2,3,1,1939,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('baldurs-gate-3','Baldur’s Gate 3','Experience Baldur’s Gate 3 and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1086940/library_600x900_2x.jpg','Larian Studios',ARRAY['RPG','Adventure'],'2023-02-10',1,8900);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (3,1,1,3999,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (3,2,2,4169,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (3,3,1,4339,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('red-dead-redemption-2','Red Dead Redemption 2','Experience Red Dead Redemption 2 and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1174180/library_600x900_2x.jpg','Rockstar Games',ARRAY['Adventure','Open world'],'2023-02-10',1,8500);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (4,1,1,1899,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (4,2,2,2069,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (4,3,1,2239,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('hogwarts-legacy','Hogwarts Legacy','Experience Hogwarts Legacy and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/990080/library_600x900_2x.jpg','Avalanche Software',ARRAY['Fantasy','Adventure'],'2023-02-10',1,8200);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (5,1,1,1249,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (5,2,2,1419,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (5,3,1,1589,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('the-witcher-3','The Witcher 3: Wild Hunt','Experience The Witcher 3: Wild Hunt and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/292030/library_600x900_2x.jpg','CD PROJEKT RED',ARRAY['RPG','Open world'],'2023-02-10',1,8000);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (6,1,1,649,3999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (6,2,2,819,3999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (6,3,1,989,3999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('god-of-war','God of War','Experience God of War and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1593500/library_600x900_2x.jpg','Santa Monica Studio',ARRAY['Action','Adventure'],'2023-02-10',1,7800);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (7,1,1,1799,4999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (7,2,2,1969,4999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (7,3,1,2139,4999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('hades','Hades','Experience Hades and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1145360/library_600x900_2x.jpg','Supergiant Games',ARRAY['Roguelike','Action'],'2023-02-10',1,7600);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (8,1,1,799,2499);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (8,2,2,969,2499);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (8,3,1,1139,2499);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('hollow-knight','Hollow Knight','Experience Hollow Knight and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/367520/library_600x900_2x.jpg','Team Cherry',ARRAY['Indie','Adventure'],'2023-02-10',1,7400);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (9,1,1,599,1499);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (9,2,2,769,1499);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (9,3,1,939,1499);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('stardew-valley','Stardew Valley','Experience Stardew Valley and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/413150/library_600x900_2x.jpg','ConcernedApe',ARRAY['Simulation','Indie'],'2023-02-10',1,7200);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (10,1,1,899,1399);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (10,2,2,1069,1399);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (10,3,1,1239,1399);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('forza-horizon-5','Forza Horizon 5','Experience Forza Horizon 5 and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/1551360/library_600x900_2x.jpg','Playground Games',ARRAY['Racing','Open world'],'2023-02-10',2,7000);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (11,1,1,2499,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (11,2,2,2669,5999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (11,3,1,2839,5999);
INSERT INTO products(slug,name,description,cover_url,developer,genres,release_date,platform_id,sales_count) VALUES ('resident-evil-4','Resident Evil 4','Experience Resident Evil 4 and discover your next great adventure. Instant digital delivery, ready to activate on your platform. Compare trusted sellers and choose the offer that works for you.','https://cdn.akamai.steamstatic.com/steam/apps/2050650/library_600x900_2x.jpg','CAPCOM',ARRAY['Horror','Action'],'2023-02-10',1,6800);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (12,1,1,1999,3999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (12,2,2,2169,3999);
INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents) VALUES (12,3,1,2339,3999);

INSERT INTO key_inventory(offer_id,key_value)
SELECT o.id,'TEST-' || upper(substr(md5(o.id::text||'-'||n::text),1,4)) || '-' || upper(substr(md5(o.id::text||'-'||n::text),5,4)) || '-' || upper(substr(md5(o.id::text||'-'||n::text),9,4))
FROM offers o CROSS JOIN generate_series(1,15) n;
INSERT INTO banners(title,subtitle,image_url,cta_label,cta_url) VALUES
('Your next adventure. For less.','Big worlds. Unforgettable stories. Discover incredible games at prices worth playing for.','https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_hero.jpg','Explore the deals','/store?sort=discount');
