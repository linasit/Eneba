CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platforms (
  id   SMALLSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,         -- steam, xbox, playstation, nintendo, epic, ea-app
  name TEXT NOT NULL
);

CREATE TABLE regions (
  id   SMALLSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,         -- global, europe, north-america, us, row
  name TEXT NOT NULL
);

CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url   TEXT NOT NULL,
  developer   TEXT,
  genres      TEXT[] NOT NULL DEFAULT '{}',
  release_date DATE,
  platform_id SMALLINT NOT NULL REFERENCES platforms(id),
  sales_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX products_platform  ON products (platform_id);
CREATE INDEX products_sales     ON products (sales_count DESC);

CREATE TABLE sellers (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  rating    NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  sales     INT NOT NULL DEFAULT 0
);

CREATE TABLE offers (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id   BIGINT NOT NULL REFERENCES sellers(id),
  region_id   SMALLINT NOT NULL REFERENCES regions(id),
  price_cents INT NOT NULL CHECK (price_cents > 0),
  old_price_cents INT,                           -- set when on deal
  currency    CHAR(3) NOT NULL DEFAULT 'EUR',
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX offers_product_price ON offers (product_id, price_cents) WHERE active;

CREATE TABLE key_inventory (
  id         BIGSERIAL PRIMARY KEY,
  offer_id   BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  key_value  TEXT NOT NULL,                      -- encrypt at rest in production (pgcrypto/KMS)
  status     TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),  -- available | sold
  order_item_id BIGINT
);
CREATE INDEX keys_available ON key_inventory (offer_id) WHERE status = 'available';

CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  total_cents  INT NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'EUR',
  status       TEXT NOT NULL,                    -- paid | failed
  payment_ref  TEXT,
  idem_key     TEXT,
  request_hash TEXT NOT NULL,
  UNIQUE(user_id, idem_key),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id    BIGINT NOT NULL REFERENCES offers(id),
  product_id  BIGINT NOT NULL REFERENCES products(id),
  unit_cents  INT NOT NULL,
  key_id      BIGINT UNIQUE NOT NULL REFERENCES key_inventory(id)
);

-- Homepage content: nothing is hardcoded in the frontend.
CREATE TABLE home_blocks (
  id        SERIAL PRIMARY KEY,
  type      TEXT NOT NULL,         -- banner | best_sellers | deals
  title     TEXT NOT NULL,
  position  INT NOT NULL,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE banners (
  id        SERIAL PRIMARY KEY,
  title     TEXT NOT NULL,
  subtitle  TEXT,
  image_url TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  cta_url   TEXT NOT NULL,
  position  INT NOT NULL DEFAULT 0,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ
);

ALTER TABLE key_inventory ADD CONSTRAINT key_order_item_fk FOREIGN KEY (order_item_id) REFERENCES order_items(id);
