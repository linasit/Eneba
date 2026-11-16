package home

import (
	"encoding/json"
	"keyvault/internal/httpx"
	"net/http"
	"strings"

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
	r.Get("/promotions/cheap-games", func(w http.ResponseWriter, req *http.Request) {
		var hero json.RawMessage
		if err := db.QueryRow(req.Context(), `SELECT config FROM promotion_pages WHERE slug='cheap-games'`).Scan(&hero); err != nil {
			httpx.Error(w, 500, "Unable to load promotion")
			return
		}
		rs, err := db.Query(req.Context(), `SELECT slug,config FROM promotion_sections WHERE page_slug='cheap-games' ORDER BY position`)
		if err != nil {
			httpx.Error(w, 500, "Unable to load promotion")
			return
		}
		sections, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to load promotion")
			return
		}
		cache(w)
		httpx.JSON(w, 200, map[string]any{"hero": hero, "sections": sections})
	})
	r.Get("/promotions/cheap-games/sections/{section}", func(w http.ResponseWriter, req *http.Request) {
		section := chi.URLParam(req, "section")
		var exists bool
		if err := db.QueryRow(req.Context(), `SELECT EXISTS(SELECT 1 FROM promotion_sections WHERE page_slug='cheap-games' AND slug=$1)`, section).Scan(&exists); err != nil {
			httpx.Error(w, 500, "Unable to load promotion")
			return
		}
		if !exists {
			httpx.Error(w, 404, "Promotion section not found")
			return
		}
		rows(w, req, db, productCardSQL+` AND p.id IN(SELECT product_id FROM home_product_groups WHERE group_slug='cheap-'||$1) ORDER BY(SELECT position FROM home_product_groups WHERE product_id=p.id AND group_slug='cheap-'||$1)`, section)
	})
	r.Get("/home/layout", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `SELECT id,type,title,config FROM home_blocks WHERE enabled ORDER BY position`)
	})

	r.Get("/home/banners", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `
		  SELECT id,title,title_lt,subtitle,image_url,thumbnail_url,cta_label,cta_url,direct_link,image_position,thumbnail_position FROM banners
		  WHERE active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now())
		  ORDER BY position`)
	})

	r.Get("/home/gift-brands", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `SELECT label,image_url,href FROM home_gift_brands ORDER BY position`)
	})
	r.Get("/home/categories", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `SELECT slug,label,label_lt,icon_url FROM home_categories ORDER BY position`)
	})
	r.Get("/home/genres", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, `SELECT g.label,g.icon,
          (SELECT count(*) FROM products p WHERE EXISTS (SELECT 1 FROM unnest(p.genres) genre WHERE lower(genre)=lower(g.label))
           AND EXISTS (SELECT 1 FROM offers o JOIN key_inventory k ON k.offer_id=o.id WHERE o.product_id=p.id AND o.active AND k.status='available')) AS count
          FROM home_genres g
          ORDER BY g.position`)
	})
	r.Get("/home/recently-viewed", func(w http.ResponseWriter, req *http.Request) {
		raw := strings.Split(req.URL.Query().Get("slugs"), ",")
		if len(raw) > 12 {
			httpx.Error(w, 400, "Recently viewed supports up to 12 products")
			return
		}
		slugs := make([]string, 0, len(raw))
		for _, slug := range raw {
			if slug = strings.TrimSpace(slug); slug != "" {
				slugs = append(slugs, slug)
			}
		}
		rows(w, req, db, productCardSQL+` AND p.slug=ANY($1::text[]) ORDER BY array_position($1::text[],p.slug) LIMIT 12`, slugs)
	})
	r.Get("/home/recommended", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+` AND p.id IN (SELECT product_id FROM home_product_groups WHERE group_slug='recommended') ORDER BY (SELECT position FROM home_product_groups WHERE product_id=p.id AND group_slug='recommended') LIMIT 5`)
	})
	r.Get("/home/gift-cards", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+` AND p.id IN (SELECT product_id FROM home_product_groups WHERE group_slug='gift-cards') ORDER BY (SELECT position FROM home_product_groups WHERE product_id=p.id AND group_slug='gift-cards') LIMIT 12`)
	})

	r.Get("/home/best-sellers", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+` AND p.categories @> ARRAY['games'] AND NOT p.categories @> ARRAY['pre-orders'] ORDER BY p.sales_count DESC, p.id ASC LIMIT 15`)
	})

	r.Get("/home/upcoming", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+` AND p.categories @> ARRAY['pre-orders'] ORDER BY p.sales_count DESC, p.id ASC LIMIT 12`)
	})

	r.Get("/home/deals", func(w http.ResponseWriter, req *http.Request) {
		rows(w, req, db, productCardSQL+`
		  AND best.old_price_cents IS NOT NULL
		  ORDER BY (best.old_price_cents - best.price_cents)::float / best.old_price_cents DESC LIMIT 12`)
	})
}

// Card = product + cheapest active offer.
const productCardSQL = `
SELECT p.id,p.slug,p.name, CASE WHEN p.name ~* 'key|gift|card' THEN p.name ELSE p.name || ' (' || CASE WHEN pl.name='Xbox' THEN 'Xbox' ELSE 'PC' END || ') ' || pl.name || ' Key ' || upper(rg.name) END AS card_title,p.cover_url,p.product_type,p.sales_count,pl.name AS platform,
       best.price_cents,best.old_price_cents,best.currency,rg.name AS region, best.id AS offer_id, (SELECT name FROM sellers WHERE id=best.seller_id) AS seller,
       CASE WHEN best.old_price_cents IS NULL THEN NULL
            ELSE round(100.0*(best.old_price_cents-best.price_cents)/best.old_price_cents) END AS discount_pct
FROM products p
JOIN platforms pl ON pl.id=p.platform_id
JOIN LATERAL (
  SELECT o.* FROM offers o WHERE o.product_id=p.id AND o.active AND EXISTS (SELECT 1 FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available')
  ORDER BY o.price_cents LIMIT 1
) best ON true
JOIN regions rg ON rg.id=best.region_id
WHERE true`
