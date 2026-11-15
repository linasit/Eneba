-- Additional simulated seller offers for the reference homepage listings.
WITH added AS (
 INSERT INTO offers(product_id,seller_id,region_id,price_cents,old_price_cents)
 SELECT o.product_id,s.id,o.region_id,o.price_cents + CASE WHEN s.name='KeyStation' THEN 170 ELSE 340 END,o.old_price_cents
 FROM offers o JOIN products p ON p.id=o.product_id CROSS JOIN sellers s
 WHERE p.id IN (SELECT product_id FROM home_product_groups WHERE group_slug='recommended')
 AND o.seller_id=(SELECT id FROM sellers WHERE name='GameNest') AND s.name IN ('KeyStation','Pixel Market')
 AND NOT EXISTS(SELECT 1 FROM offers existing WHERE existing.product_id=o.product_id AND existing.seller_id=s.id)
 RETURNING id
)
INSERT INTO key_inventory(offer_id,key_value)
SELECT added.id,'TEST-COMPARE-'||added.id||'-'||n FROM added CROSS JOIN generate_series(1,15) n;

UPDATE products SET developer='Rockstar Games',genres=ARRAY['Action','Adventure'],
 description='An open-world action-adventure set in Vice City and the surrounding state of Leonida. Compare PS5 digital-key offers by seller, activation region, price, and available stock. This is a demonstration listing: purchases deliver test keys only, not a playable game license.'
 WHERE slug='grand-theft-auto-vi-ps5';
