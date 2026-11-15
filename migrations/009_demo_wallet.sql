CREATE TABLE demo_wallet_entries (
 id bigserial PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount_cents integer NOT NULL CHECK(amount_cents>0 AND amount_cents<=100000),
 source text NOT NULL CHECK(source IN ('funds','voucher')),
 reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,reference)
);
CREATE INDEX demo_wallet_entries_user_date ON demo_wallet_entries(user_id,created_at DESC);
