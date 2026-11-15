package keyvault

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
