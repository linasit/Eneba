package auth

import (
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"keyvault/internal/httpx"
	"net/http"
	"strings"
	"time"
)

func mountWallet(r chi.Router, db *pgxpool.Pool, key []byte) {
	r.Group(func(r chi.Router) {
		r.Use(Require(key))
		r.Get("/account/wallet", func(w http.ResponseWriter, q *http.Request) {
			var total int64
			if e := db.QueryRow(q.Context(), `SELECT COALESCE(sum(amount_cents),0) FROM demo_wallet_entries WHERE user_id=$1`, UserID(q.Context())).Scan(&total); e != nil {
				httpx.Error(w, 500, "Unable to load demo wallet")
				return
			}
			rows, e := db.Query(q.Context(), `SELECT id,amount_cents,source,created_at FROM demo_wallet_entries WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`, UserID(q.Context()))
			if e != nil {
				httpx.Error(w, 500, "Unable to load demo wallet")
				return
			}
			defer rows.Close()
			entries := []map[string]any{}
			for rows.Next() {
				var id int64
				var amount int
				var source string
				var date time.Time
				if rows.Scan(&id, &amount, &source, &date) != nil {
					httpx.Error(w, 500, "Unable to load demo wallet")
					return
				}
				entries = append(entries, map[string]any{"id": id, "amount_cents": amount, "source": source, "created_at": date})
			}
			if rows.Err() != nil {
				httpx.Error(w, 500, "Unable to load demo wallet")
				return
			}
			httpx.JSON(w, 200, map[string]any{"total_cents": total, "entries": entries, "demo": true})
		})
		r.Post("/account/wallet/funds", func(w http.ResponseWriter, q *http.Request) {
			var c struct {
				Amount    int    `json:"amount_cents"`
				Reference string `json:"reference"`
			}
			if !httpx.Decode(w, q, &c) {
				return
			}
			if c.Amount < 100 || c.Amount > 100000 || len(c.Reference) < 16 || len(c.Reference) > 100 {
				httpx.Error(w, 400, "Enter an amount between €1 and €1,000")
				return
			}
			tag := "funds:" + c.Reference
			var id int64
			e := db.QueryRow(q.Context(), `INSERT INTO demo_wallet_entries(user_id,amount_cents,source,reference) VALUES($1,$2,'funds',$3) ON CONFLICT(user_id,reference) DO UPDATE SET reference=EXCLUDED.reference RETURNING id`, UserID(q.Context()), c.Amount, tag).Scan(&id)
			if e != nil {
				httpx.Error(w, 500, "Unable to add demo funds")
				return
			}
			httpx.JSON(w, 200, map[string]any{"id": id, "demo": true})
		})
		r.Post("/account/wallet/redeem", func(w http.ResponseWriter, q *http.Request) {
			var c struct {
				Code string `json:"code"`
			}
			if !httpx.Decode(w, q, &c) {
				return
			}
			if strings.ToUpper(strings.TrimSpace(c.Code)) != "DEMO10" {
				httpx.Error(w, 400, "Use the demo code DEMO10")
				return
			}
			var id int64
			e := db.QueryRow(q.Context(), `INSERT INTO demo_wallet_entries(user_id,amount_cents,source,reference) VALUES($1,1000,'voucher','voucher:DEMO10') ON CONFLICT DO NOTHING RETURNING id`, UserID(q.Context())).Scan(&id)
			if errors.Is(e, pgx.ErrNoRows) {
				httpx.Error(w, 409, "This demo code has already been redeemed")
				return
			}
			if e != nil {
				httpx.Error(w, 500, "Unable to add demo funds")
				return
			}
			httpx.JSON(w, 200, map[string]any{"id": id, "demo": true})
		})
	})
}
