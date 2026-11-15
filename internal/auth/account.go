package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"keyvault/internal/httpx"
	"net/http"
	"strings"
	"time"
)

func sealSecret(value string, key []byte) (string, error) {
	sum := sha256.Sum256(key)
	b, _ := aes.NewCipher(sum[:])
	g, _ := cipher.NewGCM(b)
	n := make([]byte, g.NonceSize())
	if _, e := rand.Read(n); e != nil {
		return "", e
	}
	return base64.RawStdEncoding.EncodeToString(g.Seal(n, n, []byte(value), nil)), nil
}
func openSecret(value string, key []byte) string {
	sum := sha256.Sum256(key)
	b, _ := aes.NewCipher(sum[:])
	g, _ := cipher.NewGCM(b)
	raw, e := base64.RawStdEncoding.DecodeString(value)
	if e != nil || len(raw) < g.NonceSize() {
		return ""
	}
	out, e := g.Open(nil, raw[:g.NonceSize()], raw[g.NonceSize():], nil)
	if e != nil {
		return ""
	}
	return string(out)
}
func validOTP(secret, code string, now time.Time) bool {
	if len(code) != 6 || secret == "" {
		return false
	}
	key, e := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if e != nil {
		return false
	}
	for delta := -1; delta <= 1; delta++ {
		var data [8]byte
		binary.BigEndian.PutUint64(data[:], uint64(now.Unix()/30+int64(delta)))
		h := hmac.New(sha1.New, key)
		h.Write(data[:])
		sum := h.Sum(nil)
		offset := sum[19] & 15
		value := (binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff) % 1000000
		if subtle.ConstantTimeCompare([]byte(fmt.Sprintf("%06d", value)), []byte(code)) == 1 {
			return true
		}
	}
	return false
}
func mountAccount(r chi.Router, db *pgxpool.Pool, key []byte) {
	r.Group(func(r chi.Router) {
		r.Use(Require(key))
		r.Get("/account/profile", func(w http.ResponseWriter, q *http.Request) {
			var username, email, secret string
			var profile json.RawMessage
			if db.QueryRow(q.Context(), `SELECT username,email,profile,totp_secret FROM users WHERE id=$1`, UserID(q.Context())).Scan(&username, &email, &profile, &secret) != nil {
				httpx.Error(w, 500, "Unable to load profile")
				return
			}
			httpx.JSON(w, 200, map[string]any{"username": username, "email": email, "profile": profile, "two_factor": secret != ""})
		})
		r.Put("/account/profile", func(w http.ResponseWriter, q *http.Request) {
			var c struct {
				Username string            `json:"username"`
				Profile  map[string]string `json:"profile"`
			}
			if !httpx.Decode(w, q, &c) {
				return
			}
			c.Username = strings.TrimSpace(c.Username)
			if len(c.Username) < 2 || len(c.Username) > 40 {
				httpx.Error(w, 400, "Username must contain 2–40 characters")
				return
			}
			allowed := map[string]bool{"first_name": true, "last_name": true, "country": true, "address": true, "company": true, "vat": true, "company_code": true}
			for k, v := range c.Profile {
				if !allowed[k] || len(v) > 250 {
					httpx.Error(w, 400, "Invalid profile field")
					return
				}
			}
			data, _ := json.Marshal(c.Profile)
			if _, e := db.Exec(q.Context(), `UPDATE users SET username=$1,profile=$2 WHERE id=$3`, c.Username, data, UserID(q.Context())); e != nil {
				httpx.Error(w, 400, "Unable to save profile")
				return
			}
			httpx.JSON(w, 200, map[string]bool{"saved": true})
		})
		r.Post("/account/password", func(w http.ResponseWriter, q *http.Request) {
			var c struct {
				Current  string `json:"current"`
				Password string `json:"password"`
			}
			if !httpx.Decode(w, q, &c) {
				return
			}
			var hash string
			db.QueryRow(q.Context(), `SELECT password_hash FROM users WHERE id=$1`, UserID(q.Context())).Scan(&hash)
			if bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Current)) != nil {
				httpx.Error(w, 400, "Current password is incorrect")
				return
			}
			if len(c.Password) < 8 || len(c.Password) > 72 {
				httpx.Error(w, 400, "Password must contain 8–72 characters")
				return
			}
			next, e := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
			if e != nil {
				httpx.Error(w, 500, "Unable to change password")
				return
			}
			if _, e = db.Exec(q.Context(), `UPDATE users SET password_hash=$1 WHERE id=$2`, string(next), UserID(q.Context())); e != nil {
				httpx.Error(w, 500, "Unable to change password")
				return
			}
			httpx.JSON(w, 200, map[string]bool{"saved": true})
		})
		r.Post("/account/two-factor/setup", func(w http.ResponseWriter, q *http.Request) {
			var active string
			if db.QueryRow(q.Context(), `SELECT totp_secret FROM users WHERE id=$1`, UserID(q.Context())).Scan(&active) != nil {
				httpx.Error(w, 500, "Unable to load profile")
				return
			}
			if active != "" {
				httpx.Error(w, 400, "Two-step verification is already enabled")
				return
			}
			raw := make([]byte, 20)
			if _, e := rand.Read(raw); e != nil {
				httpx.Error(w, 500, "Unable to set up verification")
				return
			}
			secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
			encrypted, e := sealSecret(secret, key)
			if e != nil {
				httpx.Error(w, 500, "Unable to set up verification")
				return
			}
			if _, e = db.Exec(q.Context(), `UPDATE users SET totp_pending=$1 WHERE id=$2`, encrypted, UserID(q.Context())); e != nil {
				httpx.Error(w, 500, "Unable to set up verification")
				return
			}
			httpx.JSON(w, 200, map[string]string{"secret": secret})
		})
		r.Post("/account/two-factor", func(w http.ResponseWriter, q *http.Request) {
			var c struct {
				Password string `json:"password"`
				Code     string `json:"code"`
				Enable   bool   `json:"enable"`
			}
			if !httpx.Decode(w, q, &c) {
				return
			}
			var hash, active, pending string
			db.QueryRow(q.Context(), `SELECT password_hash,totp_secret,totp_pending FROM users WHERE id=$1`, UserID(q.Context())).Scan(&hash, &active, &pending)
			encrypted := active
			if c.Enable {
				encrypted = pending
			}
			if bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil || !validOTP(openSecret(encrypted, key), c.Code, time.Now()) {
				httpx.Error(w, 400, "Incorrect password or verification code")
				return
			}
			next := ""
			if c.Enable {
				next = pending
			}
			if _, e := db.Exec(q.Context(), `UPDATE users SET totp_secret=$1,totp_pending='' WHERE id=$2`, next, UserID(q.Context())); e != nil {
				httpx.Error(w, 500, "Unable to save verification settings")
				return
			}
			httpx.JSON(w, 200, map[string]bool{"saved": true})
		})
	})
}
