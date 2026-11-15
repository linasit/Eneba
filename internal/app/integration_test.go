package app_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"keyvault/internal/app"
)

// Uses an isolated schema; never resets a supplied database.
func TestMarketplace(t *testing.T) {
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("kv_test_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema+",public")
	u.RawQuery = q.Encode()
	pool, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, name := range []string{"001_schema.sql", "002_seed.sql", "003_homepage_reference.sql", "004_product_seller_offers.sql", "005_store_filters.sql", "006_gift_card_products.sql", "007_upcoming_games.sql", "008_account_settings.sql", "009_demo_wallet.sql", "010_home_content.sql"} {
		b, e := os.ReadFile(filepath.Join("..", "..", "migrations", name))
		if e != nil {
			t.Fatal(e)
		}
		if _, e = pool.Exec(ctx, string(b)); e != nil {
			t.Fatal(e)
		}
	}
	t.Setenv("DATABASE_URL", u.String())
	t.Setenv("JWT_SECRET", strings.Repeat("test-secret", 4))
	t.Setenv("COOKIE_SECURE", "false")
	h := app.NewRouter()
	request := func(method, path, body, key string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
		if key != "" {
			r.Header.Set("Idempotency-Key", key)
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	must := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("expected %d, got %d: %s", status, w.Code, w.Body.String())
		}
	}
	register := func(name string) *http.Cookie {
		w := request("POST", "/api/auth/register", fmt.Sprintf(`{"email":"%s@example.com","username":"%s","password":"password123"}`, name, name), "", nil)
		must(w, 201)
		for _, c := range w.Result().Cookies() {
			if c.Name == "kv_session" {
				if !c.HttpOnly {
					t.Fatal("cookie must be httpOnly")
				}
				return c
			}
		}
		t.Fatal("missing cookie")
		return nil
	}
	t.Run("homepage content is database driven", func(t *testing.T) {
		for _, path := range []string{"/api/home/layout", "/api/home/gift-brands", "/api/home/genres"} {
			must(request("GET", path, "", "", nil), 200)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO home_gift_brands VALUES('Integration brand','/test.png','/store?q=test',99)`); err != nil {
			t.Fatal(err)
		}
		defer pool.Exec(ctx, `DELETE FROM home_gift_brands WHERE label='Integration brand'`)
		if !strings.Contains(request("GET", "/api/home/gift-brands", "", "", nil).Body.String(), "Integration brand") {
			t.Fatal("API must return database brands")
		}
		if _, err := pool.Exec(ctx, `UPDATE home_blocks SET config=jsonb_set(config,'{title_lt}','"Database heading"') WHERE type='recommended'`); err != nil {
			t.Fatal(err)
		}
		defer pool.Exec(ctx, `UPDATE home_blocks SET config=jsonb_set(config,'{title_lt}','"Rekomenduojama tau"') WHERE type='recommended'`)
		if !strings.Contains(request("GET", "/api/home/layout", "", "", nil).Body.String(), "Database heading") {
			t.Fatal("layout must return database configuration")
		}
		if _, err := pool.Exec(ctx, `UPDATE home_blocks SET enabled=false WHERE type='genres'`); err != nil {
			t.Fatal(err)
		}
		defer pool.Exec(ctx, `UPDATE home_blocks SET enabled=true WHERE type='genres'`)
		var blocks []struct {
			Type   string
			Config map[string]any
		}
		if err := json.Unmarshal(request("GET", "/api/home/layout", "", "", nil).Body.Bytes(), &blocks); err != nil {
			t.Fatal(err)
		}
		for _, block := range blocks {
			if block.Type == "genres" {
				t.Fatal("disabled blocks must not be returned")
			}
			if block.Config["endpoint"] == nil {
				t.Fatal("each block must declare its data source")
			}
		}
	})
	alice, bob := register("alice"), register("bob")
	t.Run("demo wallet idempotency and ownership", func(t *testing.T) {
		must(request("GET", "/api/account/wallet", "", "", nil), 401)
		payload := `{"amount_cents":2500,"reference":"test-wallet-reference-1"}`
		must(request("POST", "/api/account/wallet/funds", payload, "", alice), 200)
		must(request("POST", "/api/account/wallet/funds", payload, "", alice), 200)
		must(request("POST", "/api/account/wallet/redeem", `{"code":"DEMO10"}`, "", alice), 200)
		must(request("POST", "/api/account/wallet/redeem", `{"code":"DEMO10"}`, "", alice), 409)
		must(request("POST", "/api/account/wallet/funds", `{"amount_cents":-100,"reference":"test-wallet-reference-2"}`, "", alice), 400)
		result := request("GET", "/api/account/wallet", "", "", alice)
		must(result, 200)
		var wallet struct {
			Total   int   `json:"total_cents"`
			Entries []any `json:"entries"`
		}
		json.Unmarshal(result.Body.Bytes(), &wallet)
		if wallet.Total != 3500 || len(wallet.Entries) != 2 {
			t.Fatal("wallet credited incorrectly")
		}
		result = request("GET", "/api/account/wallet", "", "", bob)
		must(result, 200)
		json.Unmarshal(result.Body.Bytes(), &wallet)
		if wallet.Total != 0 {
			t.Fatal("wallet leaked between users")
		}
	})
	t.Run("account profile and security settings", func(t *testing.T) {
		must(request("GET", "/api/account/profile", "", "", nil), 401)
		must(request("PUT", "/api/account/profile", `{"username":"Alice Updated","profile":{"first_name":"Alice","company":"Test Studio"}}`, "", alice), 200)
		profile := request("GET", "/api/account/profile", "", "", alice)
		must(profile, 200)
		if !strings.Contains(profile.Body.String(), "Test Studio") {
			t.Fatal("profile did not persist")
		}
		other := request("GET", "/api/account/profile", "", "", bob)
		must(other, 200)
		if strings.Contains(other.Body.String(), "Test Studio") {
			t.Fatal("profile leaked across accounts")
		}
		must(request("POST", "/api/account/password", `{"current":"wrong","password":"updated123"}`, "", alice), 400)
		must(request("POST", "/api/account/password", `{"current":"password123","password":"updated123"}`, "", alice), 200)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"password123"}`, "", nil), 401)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"updated123"}`, "", nil), 200)
		must(request("POST", "/api/account/password", `{"current":"updated123","password":"password123"}`, "", alice), 200)
		setup := request("POST", "/api/account/two-factor/setup", `{}`, "", alice)
		must(setup, 200)
		var payload map[string]string
		json.Unmarshal(setup.Body.Bytes(), &payload)
		if len(payload["secret"]) != 32 {
			t.Fatal("invalid authenticator secret")
		}
		var stored string
		pool.QueryRow(ctx, `SELECT totp_pending FROM users WHERE email='alice@example.com'`).Scan(&stored)
		if stored == payload["secret"] || stored == "" {
			t.Fatal("authenticator secret not encrypted")
		}
		must(request("POST", "/api/account/two-factor", `{"enable":true,"password":"wrong","code":"000000"}`, "", alice), 400)
		otp := func() string {
			key, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(payload["secret"])
			var counter [8]byte
			binary.BigEndian.PutUint64(counter[:], uint64(time.Now().Unix()/30))
			mac := hmac.New(sha1.New, key)
			mac.Write(counter[:])
			sum := mac.Sum(nil)
			off := sum[19] & 15
			return fmt.Sprintf("%06d", (binary.BigEndian.Uint32(sum[off:off+4])&0x7fffffff)%1000000)
		}
		must(request("POST", "/api/account/two-factor", fmt.Sprintf(`{"enable":true,"password":"password123","code":"%s"}`, otp()), "", alice), 200)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"password123"}`, "", nil), 401)
		must(request("POST", "/api/auth/login", fmt.Sprintf(`{"email":"alice@example.com","password":"password123","code":"%s"}`, otp()), "", nil), 200)
		must(request("POST", "/api/account/two-factor", fmt.Sprintf(`{"enable":false,"password":"password123","code":"%s"}`, otp()), "", alice), 200)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"password123"}`, "", nil), 200)

	})
	t.Run("auth and ownership", func(t *testing.T) {
		must(request("GET", "/api/auth/me", "", "", nil), 401)
		must(request("GET", "/api/auth/me", "", "", alice), 200)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"wrong"}`, "", nil), 401)
		must(request("POST", "/api/auth/login", `{"email":"alice@example.com","password":"password123"}`, "", nil), 200)
	})
	t.Run("catalog and independent home blocks", func(t *testing.T) {
		for _, path := range []string{"/api/home/layout", "/api/home/banners", "/api/home/best-sellers", "/api/home/deals", "/api/products/elden-ring", "/api/products/elden-ring/offers?sort=rating"} {
			must(request("GET", path, "", "", nil), 200)
		}
		for _, term := range []string{"cyberpnk", "witchr 3"} {
			w := request("GET", "/api/products?q="+url.QueryEscape(term), "", "", nil)
			must(w, 200)
			var data struct{ Items []any }
			json.Unmarshal(w.Body.Bytes(), &data)
			if len(data.Items) == 0 {
				t.Fatalf("no fuzzy results for %s", term)
			}
		}
		w := request("GET", "/api/products?platform=steam&region=europe&max=10&sort=price_asc", "", "", nil)
		must(w, 200)
		var data struct {
			Items []struct {
				Platform string
				Price    int `json:"price_cents"`
				Region   string
			}
		}
		json.Unmarshal(w.Body.Bytes(), &data)
		if len(data.Items) == 0 {
			t.Fatal("expected filtered games")
		}
		prev := 0
		for _, p := range data.Items {
			if p.Platform != "Steam" || p.Region != "Europe" || p.Price > 1000 || p.Price < prev {
				t.Fatal("incorrect filtering/sorting")
			}
			prev = p.Price
		}
		must(request("GET", "/api/products/missing", "", "", nil), 404)
	})

	t.Run("reference homepage and category data", func(t *testing.T) {
		w := request("GET", "/api/home/categories", "", "", nil)
		must(w, 200)
		var categories []map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &categories); err != nil || len(categories) != 19 {
			t.Fatal("expected 19 categories", err, len(categories))
		}
		w = request("GET", "/api/home/recommended", "", "", nil)
		must(w, 200)
		var products []struct {
			OfferID int64  `json:"offer_id"`
			Name    string `json:"name"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &products); err != nil || len(products) != 5 {
			t.Fatal("expected five recommendations", err, len(products))
		}
		for _, p := range products {
			if p.OfferID <= 0 {
				t.Fatal("recommendations need a purchasable offer")
			}
		}
		w = request("GET", "/api/products?category=gaming-ecards", "", "", nil)
		must(w, 200)
		var cards struct {
			Items []struct {
				Name string `json:"name"`
			}
		}
		if err := json.Unmarshal(w.Body.Bytes(), &cards); err != nil || len(cards.Items) != 7 {
			t.Fatal("expected seven gift cards", err, len(cards.Items))
		}
		for _, p := range cards.Items {
			if !strings.Contains(p.Name, "Card") && !strings.Contains(p.Name, "Spotify Premium") {
				t.Fatal("category leaked unrelated games")
			}
		}
	})
	t.Run("gift card product carousel", func(t *testing.T) {
		w := request("GET", "/api/home/gift-cards", "", "", nil)
		must(w, 200)
		var cards []struct {
			Slug    string
			OfferID int64 `json:"offer_id"`
			Price   int   `json:"price_cents"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &cards); err != nil || len(cards) != 7 {
			t.Fatal("expected seven gift product cards", err, w.Body.String())
		}
		expected := []string{"spotify-month-brazil", "psn-card-10-usd", "psn-card-100-usd", "psn-card-50-usd", "psn-card-25-usd", "xbox-card-25-try", "psn-card-100-gbp"}
		for i, card := range cards {
			if card.Slug != expected[i] || card.OfferID <= 0 || card.Price <= 0 {
				t.Fatalf("invalid gift card %d: %+v", i, card)
			}
			must(request("GET", "/api/products/"+card.Slug, "", "", nil), 200)
			w = request("GET", "/api/products/"+card.Slug+"/offers", "", "", nil)
			var offers []struct{ Stock int }
			if err := json.Unmarshal(w.Body.Bytes(), &offers); err != nil || len(offers) < 3 {
				t.Fatal("missing seller offers", err)
			}
			for _, offer := range offers {
				if offer.Stock <= 0 {
					t.Fatal("gift offers need test stock")
				}
			}
		}
	})
	t.Run("top games excludes pre-orders", func(t *testing.T) {
		w := request("GET", "/api/home/best-sellers", "", "", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected top games, got %d: %s", w.Code, w.Body.String())
		}
		var cards []struct {
			Slug    string `json:"slug"`
			OfferID int64  `json:"offer_id"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &cards); err != nil || len(cards) != 13 {
			t.Fatalf("expected thirteen released game cards, got %s (%v)", w.Body.String(), err)
		}
		if cards[0].Slug != "minecraft-java-bedrock" {
			t.Fatalf("highest popularity released game should be first, got %s", cards[0].Slug)
		}
		for _, card := range cards {
			var releasedGame bool
			if err := pool.QueryRow(ctx, `SELECT categories @> ARRAY['games'] AND NOT categories @> ARRAY['pre-orders']
				FROM products WHERE slug=$1`, card.Slug).Scan(&releasedGame); err != nil || !releasedGame || card.OfferID <= 0 {
				t.Fatalf("top games must contain only available released games: %+v (%v)", card, err)
			}
		}
	})
	t.Run("upcoming carousel contains available pre-orders", func(t *testing.T) {
		type upcomingCard struct {
			Slug    string `json:"slug"`
			OfferID int64  `json:"offer_id"`
			Price   int    `json:"price_cents"`
		}
		expectedSlugs := []string{
			"grand-theft-auto-vi-ps5", "grand-theft-auto-vi-xbox",
			"grand-theft-auto-vi-ultimate-xbox-uk", "grand-theft-auto-vi-ps5-india",
			"grand-theft-auto-vi-xbox-latam", "grand-theft-auto-vi-xbox-brazil",
			"grand-theft-auto-vi-ultimate-xbox-india",
		}
		rows, err := pool.Query(ctx, `SELECT slug FROM products WHERE slug=ANY($1::text[]) ORDER BY sales_count DESC,id ASC`, expectedSlugs)
		if err != nil {
			t.Fatal(err)
		}
		var expected []string
		for rows.Next() {
			var slug string
			if err := rows.Scan(&slug); err != nil {
				rows.Close()
				t.Fatal(err)
			}
			expected = append(expected, slug)
		}
		rows.Close()
		if err := rows.Err(); err != nil || len(expected) != len(expectedSlugs) {
			t.Fatalf("expected all seven regional pre-order products, got %v (%v)", expected, err)
		}
		w := request("GET", "/api/home/layout", "", "", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected homepage layout, got %d: %s", w.Code, w.Body.String())
		}
		var blocks []struct{ Type, Title string }
		if err := json.Unmarshal(w.Body.Bytes(), &blocks); err != nil {
			t.Fatal(err)
		}
		upcomingBlocks := 0
		for _, block := range blocks {
			if block.Type == "deals" || block.Title == "Hot deals" {
				t.Fatalf("old deals block must be replaced: %+v", block)
			}
			if block.Type == "upcoming" {
				upcomingBlocks++
				if block.Title != "Upcoming games" {
					t.Fatalf("incorrect upcoming block title: %q", block.Title)
				}
			}
		}
		var position int
		if err := pool.QueryRow(ctx, "SELECT position FROM home_blocks WHERE type='upcoming'").Scan(&position); err != nil || upcomingBlocks != 1 || position != 7 {
			t.Fatalf("upcoming block must follow the gift-card blocks at position 7: blocks=%d position=%d (%v)", upcomingBlocks, position, err)
		}
		check := func() {
			t.Helper()
			w := request("GET", "/api/home/upcoming", "", "", nil)
			if w.Code != http.StatusOK {
				t.Fatalf("expected upcoming products, got %d: %s", w.Code, w.Body.String())
			}
			var cards []upcomingCard
			if err := json.Unmarshal(w.Body.Bytes(), &cards); err != nil || len(cards) != len(expected) {
				t.Fatalf("expected only seven pre-orders, got %s (%v)", w.Body.String(), err)
			}
			if len(cards) < 6 {
				t.Fatal("upcoming carousel needs more cards than the desktop visible row")
			}
			for i, card := range cards {
				if card.Slug != expected[i] || card.OfferID <= 0 || card.Price <= 0 {
					t.Fatalf("invalid upcoming product at %d: %+v; expected %s", i, card, expected[i])
				}
				var available bool
				if err := pool.QueryRow(ctx, `SELECT EXISTS (
					SELECT 1 FROM offers o JOIN products p ON p.id=o.product_id
					WHERE o.id=$1 AND p.slug=$2 AND o.active
					AND EXISTS (SELECT 1 FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available')
				)`, card.OfferID, card.Slug).Scan(&available); err != nil || !available {
					t.Fatalf("upcoming card needs its own available offer: %+v (%v)", card, err)
				}
			}

			w = request("GET", "/api/products?category=pre-orders", "", "", nil)
			if w.Code != http.StatusOK {
				t.Fatalf("expected pre-order store results, got %d: %s", w.Code, w.Body.String())
			}
			var store struct {
				Items []upcomingCard `json:"items"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &store); err != nil || len(store.Items) != len(cards) {
				t.Fatalf("Show all must match upcoming carousel: %s (%v)", w.Body.String(), err)
			}
			seen := make(map[string]bool, len(store.Items))
			for _, card := range store.Items {
				seen[card.Slug] = true
			}
			for _, card := range cards {
				if !seen[card.Slug] {
					t.Fatalf("upcoming product %s missing from pre-order store results", card.Slug)
				}
			}
		}
		check()

		// These high-popularity pre-orders must not displace purchasable cards.
		for _, fixture := range []struct {
			slug   string
			active bool
			stock  string
		}{
			{"upcoming-test-no-stock", true, ""},
			{"upcoming-test-sold-stock", true, "sold"},
			{"upcoming-test-inactive-offer", false, "available"},
		} {
			var offerID int64
			err := pool.QueryRow(ctx, `WITH p AS (
				INSERT INTO products(slug,name,cover_url,platform_id,categories,sales_count)
				SELECT $1,'Upcoming stock fixture','/test-cover.png',id,ARRAY['games','pre-orders'],999999
				FROM platforms WHERE slug='steam' RETURNING id
			)
			INSERT INTO offers(product_id,seller_id,region_id,price_cents,active)
			SELECT p.id,(SELECT id FROM sellers ORDER BY id LIMIT 1),(SELECT id FROM regions WHERE slug='global'),1234,$2 FROM p
			RETURNING id`, fixture.slug, fixture.active).Scan(&offerID)
			if err != nil {
				t.Fatal(err)
			}
			slug := fixture.slug
			t.Cleanup(func() {
				if _, err := pool.Exec(ctx, "DELETE FROM products WHERE slug=$1", slug); err != nil {
					t.Error(err)
				}
			})
			if fixture.stock != "" {
				if _, err := pool.Exec(ctx, "INSERT INTO key_inventory(offer_id,key_value,status) VALUES($1,'TEST-UPCOMING-STOCK',$2)", offerID, fixture.stock); err != nil {
					t.Fatal(err)
				}
			}
		}
		check()
	})
	t.Run("recently viewed products preserve requested history", func(t *testing.T) {
		type recentCard struct {
			Slug    string `json:"slug"`
			OfferID int64  `json:"offer_id"`
			Price   int    `json:"price_cents"`
		}
		check := func(slugs, expected []string) {
			t.Helper()
			path := "/api/home/recently-viewed"
			if slugs != nil {
				path += "?slugs=" + url.QueryEscape(strings.Join(slugs, ","))
			}
			w := request("GET", path, "", "", nil)
			if w.Code != http.StatusOK {
				t.Fatalf("expected recent products, got %d: %s", w.Code, w.Body.String())
			}
			var cards []recentCard
			if err := json.Unmarshal(w.Body.Bytes(), &cards); err != nil || cards == nil {
				t.Fatalf("expected a JSON array, got %s (%v)", w.Body.String(), err)
			}
			if len(cards) != len(expected) {
				t.Fatalf("expected %d recent products, got %d: %s", len(expected), len(cards), w.Body.String())
			}
			for i, card := range cards {
				if card.Slug != expected[i] || card.OfferID <= 0 || card.Price <= 0 {
					t.Fatalf("invalid recent product at %d: %+v; expected %s", i, card, expected[i])
				}
			}
		}
		check(nil, nil)
		check([]string{}, nil)
		check([]string{"no-such-history-product"}, nil)
		check(
			[]string{"cyberpunk-2077", "no-such-history-product", "elden-ring", "cyberpunk-2077"},
			[]string{"cyberpunk-2077", "elden-ring"},
		)
		twelve := []string{"resident-evil-4", "forza-horizon-5", "stardew-valley", "hollow-knight", "hades", "god-of-war", "the-witcher-3", "hogwarts-legacy", "red-dead-redemption-2", "baldurs-gate-3", "cyberpunk-2077", "elden-ring"}
		check(twelve, twelve)
		tooMany := append(append([]string{}, twelve...), "psn-card-100-gbp")
		w := request("GET", "/api/home/recently-viewed?slugs="+url.QueryEscape(strings.Join(tooMany, ",")), "", "", nil)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for more than twelve slugs, got %d: %s", w.Code, w.Body.String())
		}

		for _, fixture := range []struct {
			slug   string
			active bool
			stock  string
		}{
			{"recent-test-no-stock", true, ""},
			{"recent-test-sold-stock", true, "sold"},
			{"recent-test-inactive-offer", false, "available"},
		} {
			var offerID int64
			err := pool.QueryRow(ctx, `WITH p AS (
				INSERT INTO products(slug,name,cover_url,platform_id)
				SELECT $1,'Recently viewed stock fixture','/test-cover.png',id FROM platforms WHERE slug='steam'
				RETURNING id
			)
			INSERT INTO offers(product_id,seller_id,region_id,price_cents,active)
			SELECT p.id,(SELECT id FROM sellers ORDER BY id LIMIT 1),(SELECT id FROM regions WHERE slug='global'),1234,$2 FROM p
			RETURNING id`, fixture.slug, fixture.active).Scan(&offerID)
			if err != nil {
				t.Fatal(err)
			}
			slug := fixture.slug
			t.Cleanup(func() {
				if _, err := pool.Exec(ctx, "DELETE FROM products WHERE slug=$1", slug); err != nil {
					t.Error(err)
				}
			})
			if fixture.stock != "" {
				if _, err := pool.Exec(ctx, "INSERT INTO key_inventory(offer_id,key_value,status) VALUES($1,'TEST-RECENT-STOCK',$2)", offerID, fixture.stock); err != nil {
					t.Fatal(err)
				}
			}
		}
		check(
			[]string{"recent-test-no-stock", "elden-ring", "recent-test-sold-stock", "recent-test-inactive-offer", "cyberpunk-2077"},
			[]string{"elden-ring", "cyberpunk-2077"},
		)
	})
	t.Run("product seller comparison", func(t *testing.T) {
		w := request("GET", "/api/products/grand-theft-auto-vi-ps5/offers?sort=price", "", "", nil)
		must(w, 200)
		var offers []struct {
			ID     int64   `json:"id"`
			Price  int     `json:"price_cents"`
			Stock  int     `json:"stock"`
			Seller string  `json:"seller"`
			Rating float64 `json:"rating"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &offers); err != nil || len(offers) != 3 {
			t.Fatal("expected three seller offers", err, len(offers))
		}
		sellers := map[string]bool{}
		for i, o := range offers {
			sellers[o.Seller] = true
			if o.ID <= 0 || o.Stock <= 0 || (i > 0 && o.Price < offers[i-1].Price) {
				t.Fatal("offers need inventory and ascending prices")
			}
		}
		if len(sellers) != 3 {
			t.Fatal("expected independent sellers")
		}
		w = request("GET", "/api/products/grand-theft-auto-vi-ps5/offers?sort=rating", "", "", nil)
		must(w, 200)
		if err := json.Unmarshal(w.Body.Bytes(), &offers); err != nil {
			t.Fatal(err)
		}
		for i := 1; i < len(offers); i++ {
			if offers[i].Rating > offers[i-1].Rating {
				t.Fatal("ratings must be descending")
			}
		}
	})
	t.Run("genre directory and filtering", func(t *testing.T) {
		w := request("GET", "/api/home/genres", "", "", nil)
		must(w, 200)
		var genres []struct {
			Label string `json:"label"`
			Count int    `json:"count"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &genres); err != nil || len(genres) != 18 {
			t.Fatal("expected 18 genres", err)
		}
		for _, genre := range genres {
			w = request("GET", "/api/products?genre="+url.QueryEscape(genre.Label), "", "", nil)
			must(w, 200)
			var result struct {
				Items []json.RawMessage `json:"items"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || len(result.Items) != genre.Count {
				t.Fatalf("genre %s count mismatch: %d != %d (%v)", genre.Label, len(result.Items), genre.Count, err)
			}
		}
	})
	body := `{"card":"4242 4242 4242 4242","items":[{"offerId":1,"qty":1}]}`
	t.Run("store facets and multi-select filters", func(t *testing.T) {
		w := request("GET", "/api/catalog/filters", "", "", nil)
		if w.Code != 200 {
			t.Fatalf("facets failed: %d %s", w.Code, w.Body.String())
		}
		var facets []struct {
			Facet string
			Value string
			Count int
		}
		if err := json.Unmarshal(w.Body.Bytes(), &facets); err != nil || len(facets) == 0 {
			t.Fatal("missing facets", err)
		}
		for _, facet := range facets {
			query := url.Values{facet.Facet: {facet.Value}}
			if facet.Facet == "platform" || facet.Facet == "type" || facet.Facet == "os" || facet.Facet == "genre" || facet.Facet == "region" {
				w = request("GET", "/api/products?"+query.Encode(), "", "", nil)
				var result struct {
					Items []json.RawMessage
					Total int
				}
				if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || w.Code != 200 || result.Total != facet.Count || len(result.Items) != facet.Count {
					t.Fatalf("facet %s=%s: expected %d, response %s (%v)", facet.Facet, facet.Value, facet.Count, w.Body.String(), err)
				}
			}
		}
		for _, query := range []string{"type=games,gaming-ecards", "region=global,europe", "os=windows&platform=steam,official&type=games&genre=Action,Adventure&country=lt", "type=dlc", "min=10&max=30&sort=price_asc"} {
			w = request("GET", "/api/products?"+query, "", "", nil)
			if w.Code != 200 {
				t.Fatalf("combination failed %s: %s", query, w.Body.String())
			}
		}

		for query, expected := range map[string]int{"type=games,gaming-ecards": 26, "platform=steam,psn": 18, "region=global,europe": 15} {
			w = request("GET", "/api/products?"+query, "", "", nil)
			var result struct{ Total int }
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || result.Total != expected {
				t.Fatalf("multi-select %s: expected %d got %s", query, expected, w.Body.String())
			}
		}
		w = request("GET", "/api/products?min=10&max=30&sort=price_asc", "", "", nil)
		var priced struct {
			Items []struct {
				Price int `json:"price_cents"`
			}
		}
		if err := json.Unmarshal(w.Body.Bytes(), &priced); err != nil || len(priced.Items) == 0 {
			t.Fatal("missing price results", err)
		}
		last := 0
		for _, item := range priced.Items {
			if item.Price < 1000 || item.Price > 3000 || item.Price < last {
				t.Fatalf("incorrect price bound or sorting: %d after %d", item.Price, last)
			}
			last = item.Price
		}
		w = request("GET", "/api/products?country=invalid", "", "", nil)
		if w.Code != 400 {
			t.Fatal("invalid country should fail")
		}
		w = request("GET", "/api/products?type=dlc", "", "", nil)
		var empty struct {
			Items []json.RawMessage
			Total int
		}
		if err := json.Unmarshal(w.Body.Bytes(), &empty); err != nil || empty.Total != 0 || len(empty.Items) != 0 {
			t.Fatal("empty type should return zero products")
		}
	})

	t.Run("decline rolls back inventory", func(t *testing.T) {
		var before, after int
		pool.QueryRow(ctx, `SELECT count(*) FROM key_inventory WHERE status='sold'`).Scan(&before)
		must(request("POST", "/api/checkout", strings.Replace(body, "4242 4242 4242 4242", "4000 0000 0000 0002", 1), "declined-1", alice), 402)
		pool.QueryRow(ctx, `SELECT count(*) FROM key_inventory WHERE status='sold'`).Scan(&after)
		if before != after {
			t.Fatal("decline consumed inventory")
		}
	})
	t.Run("concurrent retries return one order", func(t *testing.T) {
		var wg sync.WaitGroup
		ws := make([]*httptest.ResponseRecorder, 2)
		for i := range ws {
			wg.Add(1)
			go func(i int) { defer wg.Done(); ws[i] = request("POST", "/api/checkout", body, "same-attempt-1", alice) }(i)
		}
		wg.Wait()
		ids := []int{}
		for _, w := range ws {
			if w.Code != 200 && w.Code != 201 {
				t.Fatal(w.Code, w.Body.String())
			}
			var result struct {
				ID int `json:"orderId"`
			}
			json.Unmarshal(w.Body.Bytes(), &result)
			ids = append(ids, result.ID)
		}
		if ids[0] != ids[1] || ids[0] == 0 {
			t.Fatal("idempotency failure")
		}
		w := request("GET", fmt.Sprintf("/api/orders/%d", ids[0]), "", "", alice)
		must(w, 200)
		if !strings.Contains(w.Body.String(), "TEST-") {
			t.Fatal("key missing")
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("private key response must not be cached")
		}
		must(request("GET", fmt.Sprintf("/api/orders/%d", ids[0]), "", "", bob), 404)
		must(request("POST", "/api/checkout", strings.Replace(body, `"qty":1`, `"qty":2`, 1), "same-attempt-1", alice), 409)
	})
	t.Run("duplicate offer lines receive distinct keys", func(t *testing.T) {
		w := request("POST", "/api/checkout", `{"card":"4242424242424242","items":[{"offerId":2,"qty":1},{"offerId":2,"qty":1}]}`, "duplicate-lines", alice)
		must(w, 201)
		var result struct {
			ID int `json:"orderId"`
		}
		json.Unmarshal(w.Body.Bytes(), &result)
		var count int
		pool.QueryRow(ctx, `SELECT count(DISTINCT key_id) FROM order_items WHERE order_id=$1`, result.ID).Scan(&count)
		if count != 2 {
			t.Fatal("duplicate key delivery")
		}
	})
	t.Run("last key has one winner", func(t *testing.T) {
		_, err := pool.Exec(ctx, `DELETE FROM key_inventory WHERE offer_id=3 AND id NOT IN (SELECT min(id) FROM key_inventory WHERE offer_id=3)`)
		if err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		ws := make([]*httptest.ResponseRecorder, 2)
		for i, c := range []*http.Cookie{alice, bob} {
			wg.Add(1)
			go func(i int, c *http.Cookie) {
				defer wg.Done()
				ws[i] = request("POST", "/api/checkout", strings.Replace(body, `"offerId":1`, `"offerId":3`, 1), fmt.Sprintf("last-key-%d", i), c)
			}(i, c)
		}
		wg.Wait()
		success, conflict := 0, 0
		for _, w := range ws {
			if w.Code == 201 {
				success++
			}
			if w.Code == 409 {
				conflict++
			}
		}
		if success != 1 || conflict != 1 {
			t.Fatalf("want one success and one conflict: %d, %d", ws[0].Code, ws[1].Code)
		}
	})
	t.Run("origin validation", func(t *testing.T) {
		r := httptest.NewRequest("POST", "http://store.test/api/auth/logout", nil)
		r.Header.Set("Origin", "https://other.test")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		must(w, 403)
	})
}
