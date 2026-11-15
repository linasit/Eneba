package app

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"keyvault/internal/auth"
	"keyvault/internal/catalog"
	"keyvault/internal/checkout"
	"keyvault/internal/db"
	"keyvault/internal/home"
	"keyvault/internal/httpx"
	"net/http"
	"net/url"
	"os"
	"time"
)

func NewRouter() http.Handler {
	secret := []byte(os.Getenv("JWT_SECRET"))
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = os.Getenv("ENEBA_DATABASE_URL")
	}
	if len(secret) < 32 || databaseURL == "" {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			httpx.Error(w, 503, "Server configuration missing: DATABASE_URL and JWT_SECRET (32+ characters) required")
		})
	}
	pool := db.MustConnect(databaseURL)
	r := chi.NewRouter()
	r.Use(middleware.Recoverer, middleware.Timeout(25*time.Second))
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
				if origin := r.Header.Get("Origin"); origin != "" {
					u, err := url.Parse(origin)
					expected := os.Getenv("APP_ORIGIN")
					if err != nil || (origin != expected && u.Host != r.Host) {
						httpx.Error(w, 403, "Origin not allowed")
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	})
	r.Route("/api", func(r chi.Router) {
		auth.Mount(r, pool, secret)
		home.Mount(r, pool)
		catalog.Mount(r, pool)
		r.Group(func(r chi.Router) { r.Use(auth.Require(secret)); checkout.Mount(r, pool) })
	})
	return r
}
