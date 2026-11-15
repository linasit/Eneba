Below is the complete Markdown file: architecture, schema, backend (Go + REST + PostgreSQL), frontend (React + TypeScript), design system, and Vercel deployment. I didn't browse Eneba's site, so the color tokens are approximations of its dark-purple look. Adjust them in one file (`tokens.css`) if you want closer matching. All payments are simulated, and no real money moves.

````markdown
# 🎮 Eneba — A 1:1 Digital Key Marketplace (Eneba-style)

> Stack: **React + TypeScript (Vite)** · **Go REST API** · **PostgreSQL (Neon)** · **Vercel**
> Payments: **Simulated provider** (Stripe test-mode adapter optional)

---

## 1. Overview

KeyVault is a marketplace where independent sellers list digital game keys, and buyers compare offers and purchase instantly.

| Feature | Summary |
|---|---|
| Store | Catalog with platform / region / price filters, sorting, name search, pagination |
| Homepage | Blocks (banner, best sellers, deals) each loaded from its own endpoint and table |
| Search | Partial names + typo tolerance via PostgreSQL `pg_trgm` |
| Product page | Product info + live seller offers, sortable comparison table |
| Checkout | Cart → simulated payment → keys delivered and stored in order history |
| Auth | Register / login, JWT in httpOnly cookie, protected routes |
| Design | Eneba-like dark purple theme, rounded cards, bright accent CTAs |

---

## 2. Architecture

```
┌──────────────────────────── Vercel ────────────────────────────┐
│  Static CDN: React SPA (web/dist)                              │
│  Serverless Go function: /api/*  (api/index.go, chi router)    │
└──────────────┬─────────────────────────────────────────────────┘
               │ pgx pool (pooled connection string)
        ┌──────▼───────┐
        │ PostgreSQL   │  Neon / Vercel Postgres
        │ pg_trgm, FTS │
        └──────────────┘
```

### Scalability decisions
- **Stateless API**: JWT auth, no server sessions. Functions scale horizontally.
- **Pooled DB connections**: use the Neon *pooled* URL because serverless opens many connections.
- **Indexes**: trigram GIN on product names, B-tree on `(product_id, price_cents)` for offers.
- **Edge caching**: `Cache-Control: s-maxage=60, stale-while-revalidate=300` on public catalog and home endpoints. Never on authenticated routes.
- **Block independence**: each homepage block has its own endpoint, so one slow block never blocks the others.
- **Key delivery safety**: `FOR UPDATE SKIP LOCKED` prevents double-selling under concurrency.
- **Growth path**: move search to Meilisearch/Elasticsearch, add Redis for cart/rate limiting, add a queue for emails and payouts. The REST contract stays unchanged.

### Repository layout

```
keyvault/
├─ api/
│  └─ index.go              # Vercel entrypoint
├─ internal/
│  ├─ app/router.go
│  ├─ auth/                 # jwt, bcrypt, middleware
│  ├─ catalog/              # store + product + search
│  ├─ home/                 # banner, bestsellers, deals
│  ├─ checkout/             # cart, orders, payments
│  └─ db/db.go
├─ migrations/
│  ├─ 001_schema.sql
│  └─ 002_seed.sql
├─ web/                     # React + TS (Vite)
│  ├─ src/
│  │  ├─ styles/tokens.css
│  │  ├─ lib/api.ts
│  │  ├─ store/cart.ts
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ main.tsx
│  └─ package.json
├─ go.mod
└─ vercel.json
```

---

## 3. Database Schema

```sql
-- migrations/001_schema.sql
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
  status     TEXT NOT NULL DEFAULT 'available',  -- available | sold
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
  idem_key     TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id    BIGINT NOT NULL REFERENCES offers(id),
  product_id  BIGINT NOT NULL REFERENCES products(id),
  unit_cents  INT NOT NULL,
  key_id      BIGINT NOT NULL REFERENCES key_inventory(id)
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
```

```sql
-- migrations/002_seed.sql (excerpt)
INSERT INTO platforms (slug,name) VALUES
 ('steam','Steam'),('xbox','Xbox'),('playstation','PlayStation'),
 ('nintendo','Nintendo'),('epic','Epic Games'),('ea-app','EA app');
INSERT INTO regions (slug,name) VALUES
 ('global','Global'),('europe','Europe'),('north-america','North America'),('row','Rest of World');
INSERT INTO home_blocks (type,title,position) VALUES
 ('banner','Featured',1),('best_sellers','Best sellers',2),('deals','Hot deals',3);
-- Add products, sellers, offers, and generated test keys (e.g. 'TEST-XXXX-XXXX-XXXX') with a seed script.
```

---

## 4. Backend (Go + REST)

### 4.1 API Contract

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account |
| POST | `/api/auth/login` | – | Log in (sets cookie) |
| POST | `/api/auth/logout` | – | Clear cookie |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/home/layout` | – | Ordered enabled blocks |
| GET | `/api/home/banners` | – | Banner block data |
| GET | `/api/home/best-sellers` | – | Best sellers data |
| GET | `/api/home/deals` | – | Deals data |
| GET | `/api/products` | – | Store: `q, platform, region, min, max, sort, page` |
| GET | `/api/products/{slug}` | – | Product details |
| GET | `/api/products/{slug}/offers` | – | Seller offers, sortable |
| GET | `/api/search/suggest?q=` | – | Typeahead (top 6) |
| POST | `/api/checkout` | ✅ | Pay and receive keys (Idempotency-Key header) |
| GET | `/api/orders` | ✅ | Order history |
| GET | `/api/orders/{id}` | ✅ | Order with keys |

### 4.2 Vercel Entrypoint

```go
// api/index.go
package handler

import (
	"net/http"
	"sync"

	"keyvault/internal/app"
)

var (
	once   sync.Once
	router http.Handler
)

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() { router = app.NewRouter() })
	router.ServeHTTP(w, r)
}
```

### 4.3 Router

```go
// internal/app/router.go
package app

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"keyvault/internal/auth"
	"keyvault/internal/catalog"
	"keyvault/internal/checkout"
	"keyvault/internal/db"
	"keyvault/internal/home"
)

func NewRouter() http.Handler {
	pool := db.MustConnect(os.Getenv("DATABASE_URL"))
	secret := []byte(os.Getenv("JWT_SECRET"))

	r := chi.NewRouter()
	r.Use(middleware.RealIP, middleware.Recoverer, middleware.Timeout(25_000_000_000))

	r.Route("/api", func(r chi.Router) {
		auth.Mount(r, pool, secret)
		home.Mount(r, pool)
		catalog.Mount(r, pool)

		r.Group(func(r chi.Router) {
			r.Use(auth.Require(secret))
			checkout.Mount(r, pool)
		})
	})
	return r
}
```

### 4.4 Authentication

```go
// internal/auth/auth.go
package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type ctxKey struct{}

type creds struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func Mount(r chi.Router, db *pgxpool.Pool, secret []byte) {
	issue := func(w http.ResponseWriter, uid int64) {
		t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(uid, 10),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		})
		s, _ := t.SignedString(secret)
		http.SetCookie(w, &http.Cookie{
			Name: "kv_session", Value: s, Path: "/", HttpOnly: true,
			Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: 7 * 86400,
		})
	}

	r.Post("/auth/register", func(w http.ResponseWriter, req *http.Request) {
		var c creds
		if json.NewDecoder(req.Body).Decode(&c) != nil || len(c.Password) < 8 || c.Email == "" {
			http.Error(w, `{"error":"Invalid input (password min 8 chars)"}`, 400)
			return
		}
		h, _ := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
		var id int64
		err := db.QueryRow(req.Context(),
			`INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING id`,
			c.Email, c.Username, string(h)).Scan(&id)
		if err != nil {
			http.Error(w, `{"error":"Email already registered"}`, 409)
			return
		}
		issue(w, id)
		json.NewEncoder(w).Encode(map[string]any{"id": id, "email": c.Email, "username": c.Username})
	})

	r.Post("/auth/login", func(w http.ResponseWriter, req *http.Request) {
		var c creds
		json.NewDecoder(req.Body).Decode(&c)
		var id int64
		var hash, username string
		err := db.QueryRow(req.Context(),
			`SELECT id,password_hash,username FROM users WHERE email=$1`, c.Email).Scan(&id, &hash, &username)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil {
			http.Error(w, `{"error":"Wrong email or password"}`, 401)
			return
		}
		issue(w, id)
		json.NewEncoder(w).Encode(map[string]any{"id": id, "email": c.Email, "username": username})
	})

	r.Post("/auth/logout", func(w http.ResponseWriter, _ *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "kv_session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: true})
		w.WriteHeader(204)
	})

	r.With(Require(secret)).Get("/auth/me", func(w http.ResponseWriter, req *http.Request) {
		uid := UserID(req.Context())
		var email, username string
		db.QueryRow(req.Context(), `SELECT email,username FROM users WHERE id=$1`, uid).Scan(&email, &username)
		json.NewEncoder(w).Encode(map[string]any{"id": uid, "email": email, "username": username})
	})
}

func Require(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie("kv_session")
			if err != nil {
				http.Error(w, `{"error":"Unauthorized"}`, 401)
				return
			}
			var claims jwt.RegisteredClaims
			tok, err := jwt.ParseWithClaims(c.Value, &claims, func(*jwt.Token) (any, error) { return secret, nil },
				jwt.WithValidMethods([]string{"HS256"}))
			if err != nil || !tok.Valid {
				http.Error(w, `{"error":"Unauthorized"}`, 401)
				return
			}
			uid, _ := strconv.ParseInt(claims.Subject, 10, 64)
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, uid)))
		})
	}
}

func UserID(ctx context.Context) int64 { v, _ := ctx.Value(ctxKey{}).(int64); return v }
```

### 4.5 Homepage Blocks (database-driven)

Each block has its own endpoint and query. The layout endpoint only says *which* blocks to render and in what order.

```go
// internal/home/home.go
package home

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func cache(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
}

func rows(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, sql string, args ...any) {
	rs, err := db.Query(r.Context(), sql, args...)
	if err != nil {
		http.Error(w, `{"error":"db"}`, 500)
		return
	}
	out, err := pgx.CollectRows(rs, pgx.RowToMap)
	if err != nil {
		http.Error(w, `{"error":"db"}`, 500)
		return
	}
	cache(w)
	json.NewEncoder(w).Encode(out)
}

func Mount(r chi.Router, db *pgxpool.Pool) {
	r.Get("/home/layout", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `SELECT id,type,title FROM home_blocks WHERE enabled ORDER BY position`)
	})

	r.Get("/home/banners", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `
		  SELECT id,title,subtitle,image_url,cta_label,cta_url FROM banners
		  WHERE active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now())
		  ORDER BY position`)
	})

	r.Get("/home/best-sellers", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+` ORDER BY p.sales_count DESC LIMIT 12`)
	})

	r.Get("/home/deals", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+`
		  AND best.old_price_cents IS NOT NULL
		  ORDER BY (best.old_price_cents - best.price_cents)::float / best.old_price_cents DESC LIMIT 12`)
	})
}

// Card = product + cheapest active offer.
const productCardSQL = `
SELECT p.id,p.slug,p.name,p.cover_url,pl.name AS platform,
       best.price_cents,best.old_price_cents,best.currency,rg.name AS region,
       CASE WHEN best.old_price_cents IS NULL THEN NULL
            ELSE round(100.0*(best.old_price_cents-best.price_cents)/best.old_price_cents) END AS discount_pct
FROM products p
JOIN platforms pl ON pl.id=p.platform_id
JOIN LATERAL (
  SELECT o.* FROM offers o WHERE o.product_id=p.id AND o.active
  ORDER BY o.price_cents LIMIT 1
) best ON true
JOIN regions rg ON rg.id=best.region_id
WHERE true`
```

### 4.6 Store, Search, and Product Page

**Search strategy:** a row matches if any condition holds:

1. Substring: `name ILIKE '%q%'` (partial names)
2. Trigram similarity: `name % q` (typos like "cyberpnk")
3. Word similarity: `word_similarity(q, name) > 0.35` (partial plus typo, like "witchr 3")

Results are ranked by the best score, with an exact prefix match boosted.

```go
// internal/catalog/catalog.go
package catalog

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const cardSelect = `
SELECT p.id,p.slug,p.name,p.cover_url,pl.name AS platform,
       best.price_cents,best.old_price_cents,best.currency,rg.name AS region,
       (SELECT count(*) FROM offers o WHERE o.product_id=p.id AND o.active) AS offer_count
FROM products p
JOIN platforms pl ON pl.id=p.platform_id`

func Mount(r chi.Router, db *pgxpool.Pool) {
	r.Get("/products", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		var (
			where = []string{"true"}
			args  []any
			add   = func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }
		)
		// Offer-level filters (region/price) are applied inside the lateral join
		offerWhere := []string{"o.product_id=p.id", "o.active"}
		if v := q.Get("region"); v != "" {
			offerWhere = append(offerWhere, "o.region_id=(SELECT id FROM regions WHERE slug="+add(v)+")")
		}
		if v, err := strconv.Atoi(q.Get("min")); err == nil {
			offerWhere = append(offerWhere, "o.price_cents>="+add(v*100))
		}
		if v, err := strconv.Atoi(q.Get("max")); err == nil {
			offerWhere = append(offerWhere, "o.price_cents<="+add(v*100))
		}
		if v := q.Get("platform"); v != "" {
			where = append(where, "pl.slug = ANY("+add(strings.Split(v, ","))+")")
		}

		score := "0::float"
		if s := strings.TrimSpace(q.Get("q")); s != "" {
			p := add(s)
			where = append(where, fmt.Sprintf(
				`(p.name ILIKE '%%'||%s||'%%' OR p.name %% %s OR word_similarity(%s,p.name)>0.35)`, p, p, p))
			score = fmt.Sprintf(`GREATEST(similarity(p.name,%[1]s), word_similarity(%[1]s,p.name),
			                    (CASE WHEN p.name ILIKE %[1]s||'%%' THEN 1 ELSE 0 END))`, p)
		}

		order := map[string]string{
			"relevance":  score + " DESC, p.sales_count DESC",
			"price_asc":  "best.price_cents ASC",
			"price_desc": "best.price_cents DESC",
			"popular":    "p.sales_count DESC",
			"newest":     "p.release_date DESC NULLS LAST",
			"discount":   "(best.old_price_cents - best.price_cents)::float/NULLIF(best.old_price_cents,0) DESC NULLS LAST",
		}[q.Get("sort")]
		if order == "" {
			order = "p.sales_count DESC"
		}

		page, _ := strconv.Atoi(q.Get("page"))
		if page < 1 {
			page = 1
		}
		const size = 24

		sql := cardSelect + `
		JOIN LATERAL (SELECT o.* FROM offers o WHERE ` + strings.Join(offerWhere, " AND ") + `
		              ORDER BY o.price_cents LIMIT 1) best ON true
		JOIN regions rg ON rg.id=best.region_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ` + order + fmt.Sprintf(" LIMIT %d OFFSET %d", size, (page-1)*size)

		rs, err := db.Query(req.Context(), sql, args...)
		if err != nil {
			http.Error(w, `{"error":"query"}`, 500)
			return
		}
		items, _ := pgx.CollectRows(rs, pgx.RowToMap)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120")
		json.NewEncoder(w).Encode(map[string]any{"items": items, "page": page, "pageSize": size})
	})

	r.Get("/search/suggest", func(w http.ResponseWriter, req *http.Request) {
		s := strings.TrimSpace(req.URL.Query().Get("q"))
		if len(s) < 2 {
			w.Write([]byte("[]"))
			return
		}
		rs, _ := db.Query(req.Context(), `
		  SELECT slug,name,cover_url FROM products
		  WHERE name ILIKE '%'||$1||'%' OR name % $1 OR word_similarity($1,name)>0.35
		  ORDER BY GREATEST(similarity(name,$1),word_similarity($1,name)) DESC, sales_count DESC
		  LIMIT 6`, s)
		out, _ := pgx.CollectRows(rs, pgx.RowToMap)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})

	r.Get("/products/{slug}", func(w http.ResponseWriter, req *http.Request) {
		rs, _ := db.Query(req.Context(), `
		  SELECT p.id,p.slug,p.name,p.description,p.cover_url,p.developer,p.genres,p.release_date,pl.name AS platform
		  FROM products p JOIN platforms pl ON pl.id=p.platform_id WHERE p.slug=$1`, chi.URLParam(req, "slug"))
		out, _ := pgx.CollectRows(rs, pgx.RowToMap)
		if len(out) == 0 {
			http.Error(w, `{"error":"Not found"}`, 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out[0])
	})

	r.Get("/products/{slug}/offers", func(w http.ResponseWriter, req *http.Request) {
		sort := map[string]string{
			"price": "o.price_cents", "rating": "s.rating DESC, o.price_cents",
		}[req.URL.Query().Get("sort")]
		if sort == "" {
			sort = "o.price_cents"
		}
		rs, _ := db.Query(req.Context(), `
		  SELECT o.id,o.price_cents,o.old_price_cents,o.currency,rg.name AS region,rg.slug AS region_slug,
		         s.name AS seller,s.rating,s.sales,
		         (SELECT count(*) FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available') AS stock
		  FROM offers o
		  JOIN products p ON p.id=o.product_id AND p.slug=$1
		  JOIN sellers s ON s.id=o.seller_id
		  JOIN regions rg ON rg.id=o.region_id
		  WHERE o.active
		  ORDER BY `+sort, chi.URLParam(req, "slug"))
		out, _ := pgx.CollectRows(rs, pgx.RowToMap)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
}
```

> The `order` and `sort` values come from a fixed whitelist map, so user input never reaches SQL as raw text. Every user-supplied value is a bind parameter.

### 4.7 Checkout: Simulated Payments + Key Delivery

```go
// internal/checkout/payment.go
package checkout

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
)

type PaymentProvider interface {
	Charge(amountCents int, currency, cardNumber string) (ref string, err error)
}

// MockProvider: no real money is ever moved.
//   4242 4242 4242 4242 -> success
//   4000 0000 0000 0002 -> declined
type MockProvider struct{}

func (MockProvider) Charge(amount int, cur, card string) (string, error) {
	switch strings.ReplaceAll(card, " ", "") {
	case "4242424242424242":
		return fmt.Sprintf("mock_pi_%d", rand.Int63()), nil
	case "4000000000000002":
		return "", errors.New("card declined (test card)")
	default:
		return "", errors.New("use a test card: 4242 4242 4242 4242")
	}
}
```

```go
// internal/checkout/checkout.go
package checkout

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"keyvault/internal/auth"
)

type item struct {
	OfferID int64 `json:"offerId"`
	Qty     int   `json:"qty"`
}
type payload struct {
	Items []item `json:"items"`
	Card  string `json:"card"` // test card only; never stored
}

func Mount(r chi.Router, db *pgxpool.Pool) {
	var pay PaymentProvider = MockProvider{}

	r.Post("/checkout", func(w http.ResponseWriter, req *http.Request) {
		uid := auth.UserID(req.Context())
		idem := req.Header.Get("Idempotency-Key")
		var p payload
		if json.NewDecoder(req.Body).Decode(&p) != nil || len(p.Items) == 0 || idem == "" {
			http.Error(w, `{"error":"Bad request"}`, 400)
			return
		}

		// Replay protection: same key returns the original order.
		var existing int64
		if db.QueryRow(req.Context(), `SELECT id FROM orders WHERE idem_key=$1 AND user_id=$2`, idem, uid).Scan(&existing) == nil {
			json.NewEncoder(w).Encode(map[string]any{"orderId": existing, "replayed": true})
			return
		}

		tx, err := db.Begin(req.Context())
		if err != nil {
			http.Error(w, `{"error":"tx"}`, 500)
			return
		}
		defer tx.Rollback(req.Context())

		type line struct {
			offerID, productID int64
			price              int
			keyID              int64
		}
		var lines []line
		total := 0

		for _, it := range p.Items {
			if it.Qty < 1 || it.Qty > 5 {
				http.Error(w, `{"error":"Quantity must be 1-5"}`, 400)
				return
			}
			var productID int64
			var price int
			if err := tx.QueryRow(req.Context(),
				`SELECT product_id,price_cents FROM offers WHERE id=$1 AND active`, it.OfferID).Scan(&productID, &price); err != nil {
				http.Error(w, `{"error":"Offer unavailable"}`, 409)
				return
			}
			// Concurrency-safe reservation: locked rows are skipped, never double sold.
			rs, _ := tx.Query(req.Context(), `
			  SELECT id FROM key_inventory WHERE offer_id=$1 AND status='available'
			  ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`, it.OfferID, it.Qty)
			ids, _ := pgx.CollectRows(rs, pgx.RowTo[int64])
			if len(ids) < it.Qty {
				http.Error(w, `{"error":"Not enough stock"}`, 409)
				return
			}
			for _, kid := range ids {
				lines = append(lines, line{it.OfferID, productID, price, kid})
				total += price
			}
		}

		ref, err := pay.Charge(total, "EUR", p.Card)
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, 402) // rollback releases the keys
			return
		}

		var orderID int64
		tx.QueryRow(req.Context(),
			`INSERT INTO orders(user_id,total_cents,status,payment_ref,idem_key) VALUES($1,$2,'paid',$3,$4) RETURNING id`,
			uid, total, ref, idem).Scan(&orderID)

		for _, l := range lines {
			var itemID int64
			tx.QueryRow(req.Context(),
				`INSERT INTO order_items(order_id,offer_id,product_id,unit_cents,key_id) VALUES($1,$2,$3,$4,$5) RETURNING id`,
				orderID, l.offerID, l.productID, l.price, l.keyID).Scan(&itemID)
			tx.Exec(req.Context(),
				`UPDATE key_inventory SET status='sold', order_item_id=$1 WHERE id=$2`, itemID, l.keyID)
			tx.Exec(req.Context(), `UPDATE products SET sales_count=sales_count+1 WHERE id=$1`, l.productID)
		}
		if err := tx.Commit(req.Context()); err != nil {
			http.Error(w, `{"error":"commit"}`, 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"orderId": orderID})
	})

	r.Get("/orders", func(w http.ResponseWriter, req *http.Request) {
		rs, _ := db.Query(req.Context(),
			`SELECT id,total_cents,currency,status,created_at FROM orders WHERE user_id=$1 ORDER BY id DESC`,
			auth.UserID(req.Context()))
		out, _ := pgx.CollectRows(rs, pgx.RowToMap)
		json.NewEncoder(w).Encode(out)
	})

	r.Get("/orders/{id}", func(w http.ResponseWriter, req *http.Request) {
		rs, _ := db.Query(req.Context(), `
		  SELECT p.name,p.cover_url,oi.unit_cents,k.key_value
		  FROM orders o
		  JOIN order_items oi ON oi.order_id=o.id
		  JOIN products p ON p.id=oi.product_id
		  JOIN key_inventory k ON k.id=oi.key_id
		  WHERE o.id=$1 AND o.user_id=$2`, chi.URLParam(req, "id"), auth.UserID(req.Context()))
		out, _ := pgx.CollectRows(rs, pgx.RowToMap)
		if len(out) == 0 {
			http.Error(w, `{"error":"Not found"}`, 404)
			return
		}
		json.NewEncoder(w).Encode(out)
	})
}
```

> **Security notes:** the card number is only compared to the test constants and never stored. Keys are returned only to the owning user. In production, encrypt `key_value` (pgcrypto or KMS envelope) and add rate limiting on `/auth/*` and `/checkout`.

---

## 5. Design System (Eneba-style)

Eneba's look is a dark violet canvas, light cards, rounded corners, and bright high-contrast CTAs. These tokens approximate it.

```css
/* web/src/styles/tokens.css */
:root {
  /* Brand */
  --purple-900: #1d0b3b;    /* page background */
  --purple-800: #2a1054;    /* header, footer */
  --purple-700: #3a1a73;    /* surfaces */
  --purple-500: #6b3fd4;    /* primary hover / links */
  --purple-400: #8a5cf0;
  --accent:     #fa4d79;    /* CTA / discount ribbons (approx) */
  --lime:       #c4f24b;    /* "Buy now", success highlights */
  --text:       #ffffff;
  --text-muted: #b9a9dc;
  --card:       #2f1760;
  --card-hover: #3b1d78;
  --border:     rgba(255,255,255,.08);
  --success:    #3ddc97;
  --danger:     #ff5d73;

  /* Typography */
  --font: "Inter", "Segoe UI", system-ui, sans-serif;
  --fs-xs: .75rem; --fs-sm: .875rem; --fs-md: 1rem;
  --fs-lg: 1.25rem; --fs-xl: 1.75rem; --fs-2xl: 2.25rem;

  /* Spacing / radius / shadow */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px; --sp-12: 48px;
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 20px; --radius-pill: 999px;
  --shadow: 0 8px 24px rgba(0,0,0,.35);
  --container: 1240px;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--purple-900); color: var(--text); }
a { color: inherit; text-decoration: none; }
.container { max-width: var(--container); margin: 0 auto; padding: 0 var(--sp-4); }

/* Buttons */
.btn { border: 0; border-radius: var(--radius-pill); padding: 12px 22px; font-weight: 700;
       cursor: pointer; transition: transform .1s, background .2s; }
.btn:active { transform: scale(.97); }
.btn-primary { background: var(--lime); color: #1d0b3b; }
.btn-primary:hover { background: #d6ff69; }
.btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn[disabled] { opacity: .5; cursor: not-allowed; }

/* Inputs */
.input { width: 100%; padding: 12px 16px; border-radius: var(--radius-pill); border: 1px solid transparent;
         background: #fff; color: #1d0b3b; font-size: var(--fs-md); }
.input:focus { outline: 3px solid var(--purple-400); }

/* Cards */
.card { background: var(--card); border-radius: var(--radius-md); overflow: hidden; transition: transform .15s, background .2s; }
.card:hover { background: var(--card-hover); transform: translateY(-3px); }
.grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.badge-discount { position: absolute; top: 8px; left: 8px; background: var(--accent); color: #fff;
                  font-weight: 800; font-size: var(--fs-xs); padding: 4px 8px; border-radius: var(--radius-sm); }
.price { font-weight: 800; font-size: var(--fs-lg); }
.price-old { color: var(--text-muted); text-decoration: line-through; font-size: var(--fs-sm); }
.skeleton { background: linear-gradient(90deg,#2f1760,#3b1d78,#2f1760); background-size: 200% 100%;
            animation: sh 1.2s infinite; border-radius: var(--radius-md); }
@keyframes sh { to { background-position: -200% 0; } }
@media (max-width: 720px) { .grid { grid-template-columns: repeat(2, 1fr); } }
```

---

## 6. Frontend (React + TypeScript)

### 6.1 Setup

```bash
npm create vite@latest web -- --template react-ts
cd web
npm i react-router-dom @tanstack/react-query zustand
```

### 6.2 API Client

```ts
// web/src/lib/api.ts
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed");
  return data as T;
}

export const eur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

export interface ProductCard {
  id: number; slug: string; name: string; cover_url: string; platform: string;
  price_cents: number; old_price_cents: number | null; currency: string; region: string;
  offer_count?: number; discount_pct?: number | null;
}
export interface Offer {
  id: number; price_cents: number; old_price_cents: number | null; region: string;
  region_slug: string; seller: string; rating: number; sales: number; stock: number;
}
```

### 6.3 Auth and Cart State

```tsx
// web/src/store/auth.tsx
import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface User { id: number; email: string; username: string }
interface Ctx {
  user: User | null; loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"], retry: false, staleTime: 5 * 60_000,
    queryFn: () => api<User>("/auth/me").catch(() => null),
  });
  const set = (u: User | null) => qc.setQueryData(["me"], u);
  return (
    <AuthCtx.Provider value={{
      user: data ?? null, loading: isLoading,
      login: async (email, password) => set(await api<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
      register: async (email, username, password) => set(await api<User>("/auth/register", { method: "POST", body: JSON.stringify({ email, username, password }) })),
      logout: async () => { await api("/auth/logout", { method: "POST" }); set(null); qc.removeQueries({ queryKey: ["orders"] }); },
    }}>{children}</AuthCtx.Provider>
  );
}
```

```tsx
// web/src/store/cart.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  offerId: number; productSlug: string; name: string; cover: string;
  seller: string; unitCents: number; qty: number;
}
interface CartState {
  lines: CartLine[];
  add(l: Omit<CartLine, "qty">): void;
  setQty(offerId: number, qty: number): void;
  remove(offerId: number): void;
  clear(): void;
  total(): number;
}
export const useCart = create<CartState>()(persist((set, get) => ({
  lines: [],
  add: (l) => set(({ lines }) => {
    const found = lines.find((x) => x.offerId === l.offerId);
    return { lines: found
      ? lines.map((x) => x.offerId === l.offerId ? { ...x, qty: Math.min(5, x.qty + 1) } : x)
      : [...lines, { ...l, qty: 1 }] };
  }),
  setQty: (id, qty) => set(({ lines }) => ({ lines: lines.map((x) => x.offerId === id ? { ...x, qty: Math.max(1, Math.min(5, qty)) } : x) })),
  remove: (id) => set(({ lines }) => ({ lines: lines.filter((x) => x.offerId !== id) })),
  clear: () => set({ lines: [] }),
  total: () => get().lines.reduce((s, l) => s + l.unitCents * l.qty, 0),
}), { name: "kv-cart" }));
```

> The cart is client-side, so guests can browse and add items. Prices are re-read server-side during checkout, so tampering with local storage can't change what's charged.

### 6.4 Global Search Bar (in the header on every page)

```tsx
// web/src/components/SearchBar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function SearchBar() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const q = useDebounced(text.trim());
  const { data = [] } = useQuery({
    queryKey: ["suggest", q], enabled: q.length >= 2,
    queryFn: () => api<{ slug: string; name: string; cover_url: string }[]>(`/search/suggest?q=${encodeURIComponent(q)}`),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setOpen(false);
    nav(`/store?q=${encodeURIComponent(text.trim())}&sort=relevance`);
  };

  return (
    <form onSubmit={submit} className="search" role="search" style={{ position: "relative", flex: 1, maxWidth: 560 }}>
      <input className="input" value={text} placeholder="Search games, gift cards, software…"
        aria-label="Search" onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} onFocus={() => setOpen(true)} />
      {open && data.length > 0 && (
        <ul style={{ position: "absolute", top: "110%", left: 0, right: 0, background: "#fff", color: "#1d0b3b",
                     borderRadius: 12, listStyle: "none", margin: 0, padding: 8, zIndex: 20, boxShadow: "var(--shadow)" }}>
          {data.map((s) => (
            <li key={s.slug}>
              <a href={`/p/${s.slug}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: 8 }}>
                <img src={s.cover_url} alt="" width={36} height={48} style={{ borderRadius: 6, objectFit: "cover" }} />
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
```

### 6.5 Product Card

```tsx
// web/src/components/ProductCard.tsx
import { Link } from "react-router-dom";
import { ProductCard as P, eur } from "../lib/api";

export default function ProductCard({ p }: { p: P }) {
  const pct = p.old_price_cents ? Math.round(100 * (p.old_price_cents - p.price_cents) / p.old_price_cents) : 0;
  return (
    <Link to={`/p/${p.slug}`} className="card" style={{ display: "block", position: "relative" }}>
      {pct > 0 && <span className="badge-discount">-{pct}%</span>}
      <img src={p.cover_url} alt={p.name} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover" }} />
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>{p.platform} · {p.region}</div>
        <div style={{ fontWeight: 600, margin: "4px 0 8px", minHeight: 40 }}>{p.name}</div>
        {p.old_price_cents && <div className="price-old">{eur(p.old_price_cents)}</div>}
        <div className="price">From {eur(p.price_cents)}</div>
      </div>
    </Link>
  );
}
```

### 6.6 Homepage (blocks load independently)

The page fetches only the *layout*. Each block component then fetches its own data, so one block can fail or load slowly without affecting the others.

```tsx
// web/src/pages/Home.tsx
import { useQuery } from "@tanstack/react-query";
import { api, ProductCard as P } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { ReactNode } from "react";

interface Block { id: number; type: "banner" | "best_sellers" | "deals"; title: string }
interface Banner { id: number; title: string; subtitle?: string; image_url: string; cta_label: string; cta_url: string }

const Skeleton = ({ n = 6 }: { n?: number }) => (
  <div className="grid">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: 320 }} />)}</div>
);

function BannerBlock() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["home", "banners"], queryFn: () => api<Banner[]>("/home/banners") });
  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !data?.length) return null;
  const b = data[0];
  return (
    <section style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", minHeight: 320,
                      background: `linear-gradient(90deg,rgba(29,11,59,.95) 30%,transparent), url(${b.image_url}) center/cover` }}>
      <div style={{ padding: "48px 40px", maxWidth: 520 }}>
        <h1 style={{ fontSize: "var(--fs-2xl)", margin: 0 }}>{b.title}</h1>
        <p style={{ color: "var(--text-muted)" }}>{b.subtitle}</p>
        <a className="btn btn-primary" href={b.cta_url}>{b.cta_label}</a>
      </div>
    </section>
  );
}

function ProductRow({ endpoint, title, keyName }: { endpoint: string; title: string; keyName: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["home", keyName], queryFn: () => api<P[]>(endpoint) });
  return (
    <Section title={title}>
      {isLoading ? <Skeleton /> : isError ? <p>Couldn't load this section.</p> :
        <div className="grid">{data!.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    </Section>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section style={{ margin: "var(--sp-8) 0" }}>
    <h2 style={{ fontSize: "var(--fs-xl)" }}>{title}</h2>{children}
  </section>
);

export default function Home() {
  const { data: layout, isLoading } = useQuery({ queryKey: ["home", "layout"], queryFn: () => api<Block[]>("/home/layout") });
  if (isLoading) return <div className="container"><Skeleton /></div>;
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      {layout?.map((b) => {
        switch (b.type) {
          case "banner":       return <BannerBlock key={b.id} />;
          case "best_sellers": return <ProductRow key={b.id} title={b.title} endpoint="/home/best-sellers" keyName="best" />;
          case "deals":        return <ProductRow key={b.id} title={b.title} endpoint="/home/deals" keyName="deals" />;
          default: return null;
        }
      })}
    </div>
  );
}
```

### 6.7 Store Page (filters, sorting, search)

Filter state lives in the URL, so every filtered view is shareable and the back button works.

```tsx
// web/src/pages/Store.tsx
import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, ProductCard as P } from "../lib/api";
import ProductCard from "../components/ProductCard";

const PLATFORMS = [["steam","Steam"],["xbox","Xbox"],["playstation","PlayStation"],["nintendo","Nintendo"],["epic","Epic Games"],["ea-app","EA app"]];
const REGIONS   = [["","Any region"],["global","Global"],["europe","Europe"],["north-america","North America"],["row","Rest of World"]];
const SORTS     = [["popular","Bestsellers"],["relevance","Best match"],["price_asc","Price: low to high"],["price_desc","Price: high to low"],["discount","Biggest discount"],["newest","Newest"]];

export default function Store() {
  const [sp, setSp] = useSearchParams();
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); n.delete("page"); setSp(n); };
  const platforms = (sp.get("platform") ?? "").split(",").filter(Boolean);
  const togglePlatform = (slug: string) =>
    set("platform", (platforms.includes(slug) ? platforms.filter((x) => x !== slug) : [...platforms, slug]).join(","));

  const { data, isFetching } = useQuery({
    queryKey: ["store", sp.toString()], placeholderData: keepPreviousData,
    queryFn: () => api<{ items: P[]; page: number; pageSize: number }>(`/products?${sp.toString()}`),
  });
  const page = Number(sp.get("page") ?? 1);

  return (
    <div className="container" style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 24, paddingTop: 24 }}>
      <aside className="card" style={{ padding: 16, alignSelf: "start" }}>
        <h3>Platform</h3>
        {PLATFORMS.map(([slug, name]) => (
          <label key={slug} style={{ display: "block", padding: "4px 0" }}>
            <input type="checkbox" checked={platforms.includes(slug)} onChange={() => togglePlatform(slug)} /> {name}
          </label>
        ))}
        <h3>Region</h3>
        <select className="input" value={sp.get("region") ?? ""} onChange={(e) => set("region", e.target.value)}>
          {REGIONS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <h3>Price (€)</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" type="number" min={0} placeholder="Min" defaultValue={sp.get("min") ?? ""} onBlur={(e) => set("min", e.target.value)} />
          <input className="input" type="number" min={0} placeholder="Max" defaultValue={sp.get("max") ?? ""} onBlur={(e) => set("max", e.target.value)} />
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 16, width: "100%" }} onClick={() => setSp(new URLSearchParams())}>Clear filters</button>
      </aside>

      <main>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>{sp.get("q") ? `Results for “${sp.get("q")}”` : "All products"}</h1>
          <select className="input" style={{ width: 220 }} value={sp.get("sort") ?? "popular"} onChange={(e) => set("sort", e.target.value)}>
            {SORTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
        <div className="grid" style={{ opacity: isFetching ? .6 : 1 }}>
          {data?.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {data?.items.length === 0 && <p>No products match. Try fewer filters or a different spelling.</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: 32 }}>
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>← Prev</button>
          <button className="btn btn-ghost" disabled={(data?.items.length ?? 0) < (data?.pageSize ?? 24)} onClick={() => set("page", String(page + 1))}>Next →</button>
        </div>
      </main>
    </div>
  );
}
```

### 6.8 Product Page with Offer Comparison

```tsx
// web/src/pages/Product.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, eur, Offer } from "../lib/api";
import { useCart } from "../store/cart";

interface Detail { id: number; name: string; description: string; cover_url: string; developer: string; genres: string[]; release_date: string; platform: string }

export default function Product() {
  const { slug } = useParams();
  const [sort, setSort] = useState<"price" | "rating">("price");
  const [region, setRegion] = useState("");
  const add = useCart((s) => s.add);

  const product = useQuery({ queryKey: ["product", slug], queryFn: () => api<Detail>(`/products/${slug}`) });
  const offers  = useQuery({ queryKey: ["offers", slug, sort], queryFn: () => api<Offer[]>(`/products/${slug}/offers?sort=${sort}`) });
  if (product.isLoading) return <div className="container skeleton" style={{ height: 400, marginTop: 24 }} />;
  if (!product.data) return <div className="container"><h1>Product not found</h1></div>;
  const p = product.data;

  const list = (offers.data ?? []).filter((o) => !region || o.region_slug === region);
  const cheapest = Math.min(...list.map((o) => o.price_cents));
  const regions = [...new Map((offers.data ?? []).map((o) => [o.region_slug, o.region])).entries()];

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 32 }}>
        <img src={p.cover_url} alt={p.name} style={{ width: "100%", borderRadius: 16 }} />
        <div>
          <h1 style={{ marginTop: 0 }}>{p.name}</h1>
          <p style={{ color: "var(--text-muted)" }}>{p.platform} · {p.developer} · {p.genres.join(", ")}</p>
          <p>{p.description}</p>
          {list.length > 0 && (
            <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ color: "var(--text-muted)" }}>Best price</div><div className="price" style={{ fontSize: "var(--fs-xl)" }}>{eur(cheapest)}</div></div>
              <button className="btn btn-primary" onClick={() => { const o = list.find((x) => x.price_cents === cheapest)!;
                add({ offerId: o.id, productSlug: p.name, name: p.name, cover: p.cover_url, seller: o.seller, unitCents: o.price_cents }); }}>
                Add to cart
              </button>
            </div>
          )}
        </div>
      </div>

      <section style={{ margin: "40px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Compare offers ({list.length})</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>{regions.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
            </select>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as "price" | "rating")}>
              <option value="price">Lowest price</option><option value="rating">Best seller rating</option>
            </select>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
            <th>Seller</th><th>Region</th><th>Rating</th><th>Stock</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--border)", background: o.price_cents === cheapest ? "rgba(196,242,75,.08)" : undefined }}>
                <td style={{ padding: 12 }}>{o.seller} <small style={{ color: "var(--text-muted)" }}>({o.sales} sales)</small>
                  {o.price_cents === cheapest && <span style={{ marginLeft: 8, color: "var(--lime)" }}>Cheapest</span>}</td>
                <td>{o.region}</td>
                <td>⭐ {o.rating.toFixed(1)}</td>
                <td>{o.stock > 0 ? `${o.stock} keys` : "Out of stock"}</td>
                <td className="price">{o.old_price_cents && <span className="price-old">{eur(o.old_price_cents)} </span>}{eur(o.price_cents)}</td>
                <td><button className="btn btn-primary" disabled={o.stock === 0}
                  onClick={() => add({ offerId: o.id, productSlug: String(slug), name: p.name, cover: p.cover_url, seller: o.seller, unitCents: o.price_cents })}>
                  Add</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

### 6.9 Checkout and Order Confirmation (protected)

```tsx
// web/src/pages/Checkout.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, eur } from "../lib/api";
import { useCart } from "../store/cart";

export default function Checkout() {
  const { lines, total, setQty, remove, clear } = useCart();
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [idem] = useState(() => crypto.randomUUID()); // one key per checkout attempt
  const nav = useNavigate();

  const pay = useMutation({
    mutationFn: () => api<{ orderId: number }>("/checkout", {
      method: "POST", headers: { "Idempotency-Key": idem },
      body: JSON.stringify({ card, items: lines.map((l) => ({ offerId: l.offerId, qty: l.qty })) }),
    }),
    onSuccess: ({ orderId }) => { clear(); nav(`/orders/${orderId}`); },
  });

  if (lines.length === 0) return <div className="container"><h1>Your cart is empty</h1></div>;
  return (
    <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, paddingTop: 24 }}>
      <section>
        <h1>Cart</h1>
        {lines.map((l) => (
          <div key={l.offerId} className="card" style={{ display: "flex", gap: 16, padding: 12, marginBottom: 12, alignItems: "center" }}>
            <img src={l.cover} alt="" width={60} height={80} style={{ borderRadius: 8, objectFit: "cover" }} />
            <div style={{ flex: 1 }}><b>{l.name}</b><div style={{ color: "var(--text-muted)" }}>Seller: {l.seller}</div></div>
            <input className="input" type="number" min={1} max={5} value={l.qty} style={{ width: 70 }} onChange={(e) => setQty(l.offerId, +e.target.value)} />
            <div className="price">{eur(l.unitCents * l.qty)}</div>
            <button className="btn btn-ghost" onClick={() => remove(l.offerId)} aria-label="Remove">✕</button>
          </div>
        ))}
      </section>
      <aside className="card" style={{ padding: 20, alignSelf: "start" }}>
        <h2 style={{ marginTop: 0 }}>Payment</h2>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          🧪 Test mode. Use <code>4242 4242 4242 4242</code> (success) or <code>4000 0000 0000 0002</code> (decline). No real charge is made.
        </p>
        <input className="input" value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" aria-label="Card number" />
        <div style={{ display: "flex", justifyContent: "space-between", margin: "20px 0" }}>
          <span>Total</span><span className="price">{eur(total())}</span>
        </div>
        {pay.isError && <p role="alert" style={{ color: "var(--danger)" }}>{(pay.error as Error).message}</p>}
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={pay.isPending} onClick={() => pay.mutate()}>
          {pay.isPending ? "Processing…" : "Pay now"}
        </button>
      </aside>
    </div>
  );
}
```

```tsx
// web/src/pages/OrderDetail.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, eur } from "../lib/api";
import { useState } from "react";

interface Line { name: string; cover_url: string; unit_cents: number; key_value: string }

export default function OrderDetail() {
  const { id } = useParams();
  const { data = [] } = useQuery({ queryKey: ["orders", id], queryFn: () => api<Line[]>(`/orders/${id}`) });
  const [copied, setCopied] = useState("");
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1>🎉 Order #{id} complete</h1>
      <p style={{ color: "var(--text-muted)" }}>Your keys are below and always available in your order history.</p>
      {data.map((l, i) => (
        <div key={i} className="card" style={{ display: "flex", gap: 16, padding: 16, marginBottom: 12, alignItems: "center" }}>
          <img src={l.cover_url} alt="" width={60} height={80} style={{ borderRadius: 8, objectFit: "cover" }} />
          <div style={{ flex: 1 }}><b>{l.name}</b> · {eur(l.unit_cents)}
            <div><code style={{ fontSize: "var(--fs-lg)", color: "var(--lime)" }}>{l.key_value}</code></div></div>
          <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(l.key_value); setCopied(l.key_value); }}>
            {copied === l.key_value ? "Copied ✓" : "Copy key"}
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 6.10 Route Guard and App Shell

```tsx
// web/src/components/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../store/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}
```

```tsx
// web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/tokens.css";
import { AuthProvider, useAuth } from "./store/auth";
import { useCart } from "./store/cart";
import SearchBar from "./components/SearchBar";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import Store from "./pages/Store";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";   // list of /api/orders (same card pattern)
import Login from "./pages/Login";     // login + register forms calling useAuth()

function Header() {
  const { user, logout } = useAuth();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  return (
    <header style={{ background: "var(--purple-800)", position: "sticky", top: 0, zIndex: 10 }}>
      <div className="container" style={{ display: "flex", gap: 24, alignItems: "center", height: 68 }}>
        <Link to="/" style={{ fontWeight: 900, fontSize: 22, color: "var(--lime)" }}>KeyVault</Link>
        <Link to="/store">Store</Link>
        <SearchBar />
        {user ? (<>
          <Link to="/orders">My orders</Link>
          <button className="btn btn-ghost" onClick={logout}>Log out ({user.username})</button>
        </>) : <Link className="btn btn-ghost" to="/login">Log in</Link>}
        <Link to="/checkout" aria-label="Cart">🛒 {count}</Link>
      </div>
    </header>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })}>
      <BrowserRouter>
        <AuthProvider>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/store" element={<Store />} />
            <Route path="/p/:slug" element={<Product />} />
            <Route path="/login" element={<Login />} />
            <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
            <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

> Guests can browse and fill a cart. Hitting **Checkout** or **My orders** redirects to `/login`, and after login they return to where they were.

---

## 7. Deployment on Vercel

### 7.1 Config

```json
// vercel.json
{
  "buildCommand": "cd web && npm ci && npm run build",
  "outputDirectory": "web/dist",
  "functions": { "api/index.go": { "maxDuration": 30 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.go" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

```go
// go.mod
module keyvault

go 1.22

require (
	github.com/go-chi/chi/v5 v5.0.12
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/jackc/pgx/v5 v5.6.0
	golang.org/x/crypto v0.24.0
)
```

```go
// internal/db/db.go
package db

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func MustConnect(url string) *pgxpool.Pool {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		log.Fatal(err)
	}
	cfg.MaxConns = 4 // small per-instance pool; the DB-side pooler does the heavy lifting
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		log.Fatal(err)
	}
	return pool
}
```

### 7.2 Steps

1. **Create the database**: add a Neon (or Vercel Postgres) project and copy the **pooled** connection string.
2. **Run migrations**:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_schema.sql
   psql "$DATABASE_URL" -f migrations/002_seed.sql
   ```
3. **Push to GitHub**, then import the repo at vercel.com/new. Leave the framework preset as **Other** since `vercel.json` handles the build.
4. **Set environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string |
   | `JWT_SECRET` | `openssl rand -hex 32` |

5. **Deploy**:
   ```bash
   npm i -g vercel
   vercel --prod
   ```
6. **Local dev**: `vercel dev` serves the SPA and the Go function together on one origin, so the `/api` proxy and cookies behave as in production.

---

## 8. QA Checklist

| Area | Test | Expected |
|---|---|---|
| Search | Type `cyberpnk` or `witcher 3` | Cyberpunk / Witcher 3 appear (typo and partial match) |
| Search | Search from product page header | Navigates to `/store?q=…` |
| Store | Platform + region + max price | URL updates, results narrow |
| Store | Change sort | Order changes; page resets to 1 |
| Home | Disable a row in `home_blocks` | Block disappears with no deploy |
| Home | Edit a `banners` row | Banner updates within about 60s (cache TTL) |
| Product | Region filter + rating sort | Table updates; cheapest row highlighted |
| Auth | Visit `/checkout` logged out | Redirect to `/login`, then back after login |
| Checkout | Card `4242…` | Order created, keys shown, stock decremented |
| Checkout | Card `4000 0000 0000 0002` | Error shown, no order created, keys still available |
| Checkout | Double-click Pay | Single order (idempotency key) |
| Concurrency | Two buyers, last key | One succeeds, one gets "Not enough stock" |

---

## 9. Roadmap

- Seller dashboard (create offers, upload keys in bulk)
- Wishlist and price alerts
- Stripe test-mode adapter implementing `PaymentProvider`
- Reviews and seller disputes
- Meilisearch for faceted search at 100k+ products
- Email delivery of keys, plus 2FA
````

**Key decisions:**
- **Search:** typo tolerance uses `pg_trgm`, so it needs no extra service at this scale.
- **Homepage:** the `home_blocks` layout table plus a separate endpoint per block meets the "no hardcoded content, separate backend source" requirement. Changing a row changes the page without a deploy.
- **Overselling:** `FOR UPDATE SKIP LOCKED` inside a transaction, plus an idempotency key, prevents double-sold keys and duplicate orders.
- **Vercel:** one catch-all Go function (`api/index.go`) with a SPA rewrite keeps the deployment to a single project.

Before going live, replace the seed placeholder keys, encrypt `key_value` at rest, and add rate limiting on `/auth/*` and `/checkout`.