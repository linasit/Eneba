ALTER TABLE banners ADD COLUMN thumbnail_position text NOT NULL DEFAULT 'right center';
UPDATE banners SET image_url='/reference/banners/lt-gift-cards-expanded.png',image_position='right center',direct_link=false WHERE active AND position=3;
UPDATE banners SET thumbnail_url='/reference/banners/lt-gift-cards-expanded.png',thumbnail_position='left center' WHERE active AND position=0;
