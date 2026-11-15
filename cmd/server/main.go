package main

import (
	"keyvault/internal/app"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	log.Printf("API listening at http://%s", addr)
	s := http.Server{Addr: addr, Handler: app.NewRouter(), ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(s.ListenAndServe())
}
