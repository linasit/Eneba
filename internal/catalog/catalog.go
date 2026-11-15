package catalog

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"keyvault/internal/httpx"
)

const cardSelect = `
SELECT p.id,p.slug,p.name,p.cover_url,p.product_type,p.sales_count,pl.name AS platform,
       best.price_cents,best.old_price_cents,best.currency,rg.name AS region, best.id AS offer_id, (SELECT name FROM sellers WHERE id=best.seller_id) AS seller,
       (SELECT count(*) FROM offers o WHERE o.product_id=p.id AND o.active) AS offer_count
FROM products p
JOIN platforms pl ON pl.id=p.platform_id`

func Mount(r chi.Router, db *pgxpool.Pool) {
	mountFilters(r, db)
	r.Get("/products", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		var (
			where = []string{"true"}
			args  []any
			add   = func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }
		)
		// Offer-level filters (region/price) are applied inside the lateral join
		offerWhere := []string{"o.product_id=p.id", "o.active", "EXISTS (SELECT 1 FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available')"}
		if v := q.Get("region"); v != "" {
			offerWhere = append(offerWhere, "o.region_id IN (SELECT id FROM regions WHERE slug=ANY("+add(strings.Split(v, ","))+"))")
		}
		if country := q.Get("country"); country != "" {
			regions, ok := countryRegions[country]
			if !ok {
				httpx.Error(w, 400, "Unknown activation country")
				return
			}
			offerWhere = append(offerWhere, "o.region_id IN (SELECT id FROM regions WHERE slug=ANY("+add(regions)+"))")
		}

		for _, bound := range []struct{ name, op string }{{"min", ">="}, {"max", "<="}} {
			if raw := q.Get(bound.name); raw != "" {
				value, err := strconv.ParseFloat(raw, 64)
				if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > 1000000 {
					httpx.Error(w, 400, "Price filters must be between 0 and 1000000")
					return
				}
				offerWhere = append(offerWhere, "o.price_cents"+bound.op+add(int(math.Round(value*100))))
			}
		}

		if v := q.Get("platform"); v != "" {
			where = append(where, "pl.slug = ANY("+add(strings.Split(v, ","))+")")
		}

		if category := q.Get("category"); category != "" && category != "games" {
			where = append(where, "p.categories @> ARRAY["+add(category)+"]::text[]")
		}
		if q.Get("category") == "games" {
			where = append(where, "p.categories @> ARRAY['games']")
		}
		if genre := q.Get("genre"); genre != "" {
			values := strings.Split(strings.ToLower(genre), ",")
			where = append(where, "EXISTS (SELECT 1 FROM unnest(p.genres) genre WHERE lower(genre)=ANY("+add(values)+"))")
		}
		if v := q.Get("type"); v != "" {
			where = append(where, "p.product_type=ANY("+add(strings.Split(v, ","))+")")
		}
		if v := q.Get("os"); v != "" {
			where = append(where, "p.operating_systems && "+add(strings.Split(v, ","))+"::text[]")
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
			"oldest":     "p.release_date ASC NULLS LAST",
			"name_asc":   "p.name ASC",
			"name_desc":  "p.name DESC",
			"newest":     "p.release_date DESC NULLS LAST",
			"discount":   "(best.old_price_cents - best.price_cents)::float/NULLIF(best.old_price_cents,0) DESC NULLS LAST",
		}[q.Get("sort")]
		if order == "" {
			order = score + " DESC, p.sales_count DESC"
		}

		page, _ := strconv.Atoi(q.Get("page"))
		if page > 100000 {
			page = 100000
		}
		if page < 1 {
			page = 1
		}
		const size = 24

		from := `
        JOIN LATERAL (SELECT o.* FROM offers o WHERE ` + strings.Join(offerWhere, " AND ") + `
                      ORDER BY o.price_cents LIMIT 1) best ON true
        JOIN regions rg ON rg.id=best.region_id
        WHERE ` + strings.Join(where, " AND ")
		var total int
		if err := db.QueryRow(req.Context(), "SELECT count(*) FROM products p JOIN platforms pl ON pl.id=p.platform_id"+from, args...).Scan(&total); err != nil {
			httpx.Error(w, 500, "Unable to count products")
			return
		}
		sql := cardSelect + from + ` ORDER BY ` + order + ", p.id ASC" + fmt.Sprintf(" LIMIT %d OFFSET %d", size, (page-1)*size)

		rs, err := db.Query(req.Context(), sql, args...)
		if err != nil {
			http.Error(w, `{"error":"query"}`, 500)
			return
		}
		items, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read products")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120")
		json.NewEncoder(w).Encode(map[string]any{"items": items, "page": page, "pageSize": size, "total": total})
	})

	r.Get("/search/suggest", func(w http.ResponseWriter, req *http.Request) {
		s := strings.TrimSpace(req.URL.Query().Get("q"))
		if len(s) < 2 {
			w.Write([]byte("[]"))
			return
		}
		rs, err := db.Query(req.Context(), `
		  SELECT slug,name,cover_url FROM products
		  WHERE name ILIKE '%'||$1||'%' OR name % $1 OR word_similarity($1,name)>0.35
		  ORDER BY GREATEST(similarity(name,$1),word_similarity($1,name)) DESC, sales_count DESC
		  LIMIT 6`, s)
		if err != nil {
			httpx.Error(w, 500, "Unable to load catalog")
			return
		}
		out, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read catalog")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})

	r.Get("/products/{slug}", func(w http.ResponseWriter, req *http.Request) {
		rs, err := db.Query(req.Context(), `
		  SELECT p.id,p.slug,p.name,p.description,p.cover_url,p.developer,p.genres,p.release_date,p.product_type,p.sales_count,pl.name AS platform
		  FROM products p JOIN platforms pl ON pl.id=p.platform_id WHERE p.slug=$1`, chi.URLParam(req, "slug"))
		if err != nil {
			httpx.Error(w, 500, "Unable to load catalog")
			return
		}
		out, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read catalog")
			return
		}
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
		rs, err := db.Query(req.Context(), `
		  SELECT o.id,o.price_cents,o.old_price_cents,o.currency,rg.name AS region,rg.slug AS region_slug,
		         s.name AS seller,s.rating::float8 AS rating,s.sales,
		         (SELECT count(*) FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available') AS stock
		  FROM offers o
		  JOIN products p ON p.id=o.product_id AND p.slug=$1
		  JOIN sellers s ON s.id=o.seller_id
		  JOIN regions rg ON rg.id=o.region_id
		  WHERE o.active
		  ORDER BY `+sort, chi.URLParam(req, "slug"))
		if err != nil {
			httpx.Error(w, 500, "Unable to load catalog")
			return
		}
		out, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read catalog")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
}
