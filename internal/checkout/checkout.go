package checkout

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"keyvault/internal/auth"
	"keyvault/internal/httpx"
	"net/http"
	"sort"
	"strconv"
)

type item struct {
	OfferID int64 `json:"offerId"`
	Qty     int   `json:"qty"`
}
type payload struct {
	Items []item `json:"items"`
	Card  string `json:"card"`
}

func normalize(items []item) ([]item, error) {
	if len(items) == 0 || len(items) > 50 {
		return nil, errors.New("Cart must contain 1–50 offers")
	}
	quantities := map[int64]int{}
	for _, it := range items {
		if it.OfferID < 1 || it.Qty < 1 || it.Qty > 5 {
			return nil, errors.New("Quantity must be 1–5")
		}
		quantities[it.OfferID] += it.Qty
		if quantities[it.OfferID] > 5 {
			return nil, errors.New("Maximum 5 keys per offer")
		}
	}
	out := make([]item, 0, len(quantities))
	for id, qty := range quantities {
		out = append(out, item{id, qty})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].OfferID < out[j].OfferID })
	return out, nil
}
func Mount(r chi.Router, db *pgxpool.Pool) {
	r.Post("/checkout", func(w http.ResponseWriter, req *http.Request) {
		uid := auth.UserID(req.Context())
		idem := req.Header.Get("Idempotency-Key")
		var p payload
		if !httpx.Decode(w, req, &p) {
			return
		}
		items, err := normalize(p.Items)
		if err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		if len(idem) < 8 || len(idem) > 128 {
			httpx.Error(w, 400, "A valid Idempotency-Key is required")
			return
		}
		encoded, _ := json.Marshal(items)
		sum := sha256.Sum256(encoded)
		fingerprint := hex.EncodeToString(sum[:])
		tx, err := db.Begin(req.Context())
		if err != nil {
			httpx.Error(w, 500, "Unable to start checkout")
			return
		}
		defer tx.Rollback(req.Context())
		fail := func(err error) bool {
			if err != nil {
				httpx.Error(w, 500, "Checkout could not be completed. Please retry")
				return true
			}
			return false
		}
		// Serialize retries before inventory is reserved. Locks are transaction scoped.
		_, err = tx.Exec(req.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, strconv.FormatInt(uid, 10)+":"+idem)
		if fail(err) {
			return
		}
		var existing int64
		var previous string
		err = tx.QueryRow(req.Context(), `SELECT id,request_hash FROM orders WHERE user_id=$1 AND idem_key=$2`, uid, idem).Scan(&existing, &previous)
		if err == nil {
			if previous != fingerprint {
				httpx.Error(w, 409, "This checkout attempt belongs to a different cart")
				return
			}
			httpx.JSON(w, 200, map[string]any{"orderId": existing, "replayed": true})
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			fail(err)
			return
		}
		type line struct {
			offerID, productID, keyID int64
			price                     int
		}
		var lines []line
		total := 0
		for _, it := range items {
			var productID int64
			var price int
			err = tx.QueryRow(req.Context(), `SELECT product_id,price_cents FROM offers WHERE id=$1 AND active AND currency='EUR' FOR SHARE`, it.OfferID).Scan(&productID, &price)
			if errors.Is(err, pgx.ErrNoRows) {
				httpx.Error(w, 409, "Offer unavailable")
				return
			}
			if fail(err) {
				return
			}
			rs, err := tx.Query(req.Context(), `SELECT id FROM key_inventory WHERE offer_id=$1 AND status='available' ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`, it.OfferID, it.Qty)
			if fail(err) {
				return
			}
			ids, err := pgx.CollectRows(rs, pgx.RowTo[int64])
			if fail(err) {
				return
			}
			if len(ids) < it.Qty {
				httpx.Error(w, 409, "Not enough stock")
				return
			}
			for _, id := range ids {
				lines = append(lines, line{it.OfferID, productID, id, price})
				total += price
			}
		}
		ref, err := (MockProvider{}).Charge(total, "EUR", p.Card)
		if err != nil {
			httpx.Error(w, 402, err.Error())
			return
		}
		var orderID int64
		err = tx.QueryRow(req.Context(), `INSERT INTO orders(user_id,total_cents,status,payment_ref,idem_key,request_hash) VALUES($1,$2,'paid',$3,$4,$5) RETURNING id`, uid, total, ref, idem, fingerprint).Scan(&orderID)
		if fail(err) {
			return
		}
		for _, l := range lines {
			var itemID int64
			err = tx.QueryRow(req.Context(), `INSERT INTO order_items(order_id,offer_id,product_id,unit_cents,key_id) VALUES($1,$2,$3,$4,$5) RETURNING id`, orderID, l.offerID, l.productID, l.price, l.keyID).Scan(&itemID)
			if fail(err) {
				return
			}
			_, err = tx.Exec(req.Context(), `UPDATE key_inventory SET status='sold',order_item_id=$1 WHERE id=$2`, itemID, l.keyID)
			if fail(err) {
				return
			}
			_, err = tx.Exec(req.Context(), `UPDATE products SET sales_count=sales_count+1 WHERE id=$1`, l.productID)
			if fail(err) {
				return
			}
		}
		if fail(tx.Commit(req.Context())) {
			return
		}
		httpx.JSON(w, 201, map[string]any{"orderId": orderID})
	})
	r.Get("/orders", func(w http.ResponseWriter, req *http.Request) {
		rs, err := db.Query(req.Context(), `SELECT id,total_cents,currency,status,created_at FROM orders WHERE user_id=$1 ORDER BY id DESC`, auth.UserID(req.Context()))
		if err != nil {
			httpx.Error(w, 500, "Unable to load orders")
			return
		}
		out, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read orders")
			return
		}
		httpx.JSON(w, 200, out)
	})
	r.Get("/orders/{id}", func(w http.ResponseWriter, req *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
		if err != nil || id < 1 {
			httpx.Error(w, 404, "Order not found")
			return
		}
		rs, err := db.Query(req.Context(), `SELECT p.name,p.cover_url,oi.unit_cents,k.key_value FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id JOIN key_inventory k ON k.id=oi.key_id WHERE o.id=$1 AND o.user_id=$2 ORDER BY oi.id`, id, auth.UserID(req.Context()))
		if err != nil {
			httpx.Error(w, 500, "Unable to load order")
			return
		}
		out, err := pgx.CollectRows(rs, pgx.RowToMap)
		if err != nil {
			httpx.Error(w, 500, "Unable to read order")
			return
		}
		if len(out) == 0 {
			httpx.Error(w, 404, "Order not found")
			return
		}
		httpx.JSON(w, 200, out)
	})
}
