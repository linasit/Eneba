package catalog

import (
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"keyvault/internal/httpx"
	"net/http"
)

// Activation-country matching uses the region restrictions recorded in this demo catalog.
var countryRegions = map[string][]string{
	"lt": {"global", "europe"}, "de": {"global", "europe"}, "fr": {"global", "europe"},
	"us": {"global", "us", "north-america"}, "uk": {"global", "uk", "europe"},
}

func mountFilters(r chi.Router, db *pgxpool.Pool) {
	r.Get("/catalog/filters", func(w http.ResponseWriter, req *http.Request) {
		rows, err := db.Query(req.Context(), `WITH available AS (
    SELECT DISTINCT p.* FROM products p JOIN offers o ON o.product_id=p.id
    WHERE o.active AND EXISTS(SELECT 1 FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available')
  ), facets AS (
    SELECT 'platform' AS facet, pl.slug AS value, pl.name AS label, count(*) AS count FROM available p JOIN platforms pl ON pl.id=p.platform_id GROUP BY pl.slug,pl.name
    UNION ALL SELECT 'type',product_type,product_type,count(*) FROM available GROUP BY product_type
    UNION ALL SELECT 'os',os,os,count(*) FROM available CROSS JOIN LATERAL unnest(operating_systems) os GROUP BY os
    UNION ALL SELECT 'genre',genre,genre,count(*) FROM available CROSS JOIN LATERAL unnest(genres) genre GROUP BY genre
    UNION ALL SELECT 'region',rg.slug,rg.name,count(DISTINCT p.id) FROM available p JOIN offers o ON o.product_id=p.id JOIN regions rg ON rg.id=o.region_id WHERE o.active AND EXISTS(SELECT 1 FROM key_inventory k WHERE k.offer_id=o.id AND k.status='available') GROUP BY rg.slug,rg.name
  ) SELECT * FROM facets ORDER BY facet,count DESC,label`)
		if err != nil {
			httpx.Error(w, 500, "Unable to load filters")
			return
		}
		values, err := pgx.CollectRows(rows, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read filters")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120")
		json.NewEncoder(w).Encode(values)
	})
}
