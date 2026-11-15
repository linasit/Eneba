package auth

import (
	"context"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"keyvault/internal/httpx"
)

type ctxKey struct{}
type creds struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

func secure() bool { return os.Getenv("COOKIE_SECURE") != "false" }
func Mount(r chi.Router, db *pgxpool.Pool, secret []byte) {
	mountAccount(r, db, secret)
	mountWallet(r, db, secret)
	issue := func(w http.ResponseWriter, uid int64) bool {
		t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: strconv.FormatInt(uid, 10), ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour))})
		s, err := t.SignedString(secret)
		if err != nil {
			httpx.Error(w, 500, "Unable to create session")
			return false
		}
		http.SetCookie(w, &http.Cookie{Name: "kv_session", Value: s, Path: "/", HttpOnly: true, Secure: secure(), SameSite: http.SameSiteLaxMode, MaxAge: 7 * 86400})
		return true
	}
	r.Post("/auth/register", func(w http.ResponseWriter, req *http.Request) {
		var c creds
		if !httpx.Decode(w, req, &c) {
			return
		}
		c.Email = strings.ToLower(strings.TrimSpace(c.Email))
		c.Username = strings.TrimSpace(c.Username)
		a, err := mail.ParseAddress(c.Email)
		if err != nil || a.Address != c.Email || len(c.Email) > 254 || len(c.Username) < 2 || len(c.Username) > 40 || len(c.Password) < 8 || len(c.Password) > 72 {
			httpx.Error(w, 400, "Enter a valid email, a 2–40 character username, and an 8–72 character password")
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
		if err != nil {
			httpx.Error(w, 500, "Unable to create account")
			return
		}
		var id int64
		err = db.QueryRow(req.Context(), `INSERT INTO users(email,username,password_hash) VALUES($1,$2,$3) RETURNING id`, c.Email, c.Username, string(hash)).Scan(&id)
		if err != nil {
			var pe *pgconn.PgError
			if errors.As(err, &pe) && pe.Code == "23505" {
				httpx.Error(w, 409, "Email already registered")
			} else {
				httpx.Error(w, 500, "Unable to create account")
			}
			return
		}
		if issue(w, id) {
			httpx.JSON(w, 201, map[string]any{"id": id, "email": c.Email, "username": c.Username})
		}
	})
	r.Post("/auth/login", func(w http.ResponseWriter, req *http.Request) {
		var c creds
		if !httpx.Decode(w, req, &c) {
			return
		}
		var id int64
		var hash, username, factor string
		var locked time.Time
		err := db.QueryRow(req.Context(), `SELECT id,password_hash,username,totp_secret,COALESCE(totp_locked_until,'epoch'::timestamptz) FROM users WHERE email=$1`, strings.ToLower(strings.TrimSpace(c.Email))).Scan(&id, &hash, &username, &factor, &locked)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil {
			httpx.Error(w, 401, "Wrong email or password")
			return
		}
		if factor != "" {
			if locked.After(time.Now()) {
				httpx.Error(w, 429, "Too many verification attempts. Try again in 5 minutes.")
				return
			}
			if !validOTP(openSecret(factor, secret), c.Code, time.Now()) {
				if c.Code != "" {
					db.Exec(req.Context(), `UPDATE users SET totp_failures=CASE WHEN totp_failures>=4 THEN 0 ELSE totp_failures+1 END,totp_locked_until=CASE WHEN totp_failures>=4 THEN now()+interval '5 minutes' ELSE NULL END WHERE id=$1`, id)
				}
				httpx.Error(w, 401, "Two-step verification code required")
				return
			}
			db.Exec(req.Context(), `UPDATE users SET totp_failures=0,totp_locked_until=NULL WHERE id=$1`, id)
		}
		if issue(w, id) {
			httpx.JSON(w, 200, map[string]any{"id": id, "email": strings.ToLower(strings.TrimSpace(c.Email)), "username": username})
		}
	})
	r.Post("/auth/logout", func(w http.ResponseWriter, _ *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "kv_session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: secure(), SameSite: http.SameSiteLaxMode})
		w.WriteHeader(204)
	})
	r.With(Require(secret)).Get("/auth/me", func(w http.ResponseWriter, req *http.Request) {
		id := UserID(req.Context())
		var email, username string
		if db.QueryRow(req.Context(), `SELECT email,username FROM users WHERE id=$1`, id).Scan(&email, &username) != nil {
			httpx.Error(w, 401, "Session expired")
			return
		}
		httpx.JSON(w, 200, map[string]any{"id": id, "email": email, "username": username})
	})
}
func Require(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie("kv_session")
			if err != nil {
				httpx.Error(w, 401, "Please log in to continue")
				return
			}
			var claims jwt.RegisteredClaims
			tok, err := jwt.ParseWithClaims(c.Value, &claims, func(*jwt.Token) (any, error) { return secret, nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
			id, e := strconv.ParseInt(claims.Subject, 10, 64)
			if err != nil || tok == nil || !tok.Valid || e != nil || id <= 0 {
				httpx.Error(w, 401, "Session expired. Please log in again")
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
		})
	}
}
func UserID(ctx context.Context) int64 { v, _ := ctx.Value(ctxKey{}).(int64); return v }
