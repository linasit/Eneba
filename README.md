# Eneba

Production: https://eneba-neon.vercel.app — Vercel project `eneba`, with Neon PostgreSQL in Frankfurt. Payments and keys remain simulated.

A digital game-key marketplace based on the attached specification, implemented with React + TypeScript, Go REST, and PostgreSQL. All payments and delivered keys are simulated.

## Run locally

Requires Go 1.22+, Node.js 20.19+, npm, and PostgreSQL 14+ with permission to install `pg_trgm` and `citext`.

1. Create an empty database, for example `createdb keyvault`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters (`openssl rand -hex 32`). Keep `COOKIE_SECURE=false` for local HTTP only.
3. Apply the schema and seed to the **empty** database:

   ```sh
   set -a
   source .env
   set +a
   for migration in migrations/[0-9]*.sql; do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" || break
   done
   ```

4. Install and run:

   ```sh
   npm ci --prefix web
   go mod download
   ./scripts/dev.sh
   ```

Open http://127.0.0.1:5173. Vite proxies `/api` to the Go server on port 8080. Register a test account to checkout. No shared demo credentials are needed.

The migrations contain the catalog, available offers, unique test keys, and editable promotional banners. Campaign art, category icons, and reference product covers are hosted with the app. Original game cover art is loaded from Steam's CDN and requires an internet connection. Steam has the main catalog; Xbox has one sample game. Other platform filters correctly return no matching products until populated.

## Features

- Database-driven home layout and independent banner, bestseller, and deal endpoints.
- Catalog search with PostgreSQL trigram typo matching, platform/region/price filters, sorting and URL-backed pagination.
- Product pages with region filtering, seller ratings and available stock.
- Persistent guest cart; checkout and order history require authentication.
- bcrypt passwords and JWT sessions in httpOnly cookies. Private responses use `no-store`.
- Simulated payment: `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` declines.
- Server-authoritative prices; atomic key delivery with row locks and unique key ownership.
- User-scoped idempotency locks serialize concurrent retries. Changed carts cannot reuse a completed attempt.

## Validation

```sh
npm run build --prefix web
go test ./...
TEST_DATABASE_URL='postgres://localhost/keyvault?sslmode=disable' go test ./internal/app -v -count=1
```

Integration tests create and remove a uniquely named schema in the specified test database. They check auth, fuzzy search, filters, homepage endpoints, declined payments, concurrent retry idempotency, duplicate-line key uniqueness, order ownership, origin validation and contention for the last key. Use a dedicated development/test database with schema creation permission. Without `TEST_DATABASE_URL`, database integration tests skip explicitly.

## Vercel

`vercel.json` builds `web/dist`, serves the SPA, and routes `/api/*` to the Go handler. Import this repository as one Vercel project using the **Other** preset and the repository root. Configure:

- `DATABASE_URL`: your Neon pooled PostgreSQL URL, with TLS enabled.
- `JWT_SECRET`: a random value of at least 32 characters.
- `APP_ORIGIN`: the exact deployed website origin.
- `COOKIE_SECURE`: `true` (also the default).

For a fresh Vercel target, connect the database integration before deployment; the build initializes it. Do not manually rerun the seed against an initialized deployment. The Vercel build applies pending migrations in one locked transaction. A checksum ledger prevents repeated seeds and rejects edits to migrations already applied. Existing untracked schemas require manual inspection. Subsequent builds preserve users, orders and inventory. Deploy through Vercel's Git import or `vercel` for a preview. The local checkout is linked to the `eneba` Vercel project. The connected Neon integration uses the `ENEBA_DATABASE_URL` prefix, which the API accepts alongside `DATABASE_URL`.

## Before production use

This is a functional demo. Keys are clearly marked `TEST-`; the simulated payment provider only accepts the documented test numbers. Real sales require a payment integration, encrypted key storage, distributed rate limiting, account recovery, monitoring, and applicable marketplace policies. Do not enter real payment details. The design is an Eneba-inspired purple storefront under the KeyVault name; it is not an exact reproduction or an affiliated service.

`SPECIFICATION.md` preserves the supplied source document. The implementation fixes omissions and correctness issues in those snippets; use the actual repository files for current behavior.

Homepage reference assets were captured from the user-provided Eneba reference on November 13, 2026. All reference listings and delivered keys in this demo are simulated. Wishlist entries are stored in the browser. The promotion carousel supports manual selection, autoplay, pausing, swipe, and reduced-motion preferences. Category arrows and touch scrolling browse all 19 categories; category links filter real catalog records, including empty states for categories not stocked in this demo.
