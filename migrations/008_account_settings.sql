ALTER TABLE users ADD COLUMN profile jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN totp_secret text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_pending text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_failures integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_locked_until timestamptz;
