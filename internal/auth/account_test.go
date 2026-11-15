package auth

import (
	"testing"
	"time"
)

func TestAuthenticator(t *testing.T) {
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	if !validOTP(secret, "287082", time.Unix(59, 0)) {
		t.Fatal("RFC 6238 test vector rejected")
	}
	if validOTP(secret, "123456", time.Unix(59, 0)) {
		t.Fatal("incorrect code accepted")
	}
	key := []byte("test encryption key")
	sealed, e := sealSecret(secret, key)
	if e != nil || sealed == secret {
		t.Fatal("secret not encrypted")
	}
	if openSecret(sealed, key) != secret {
		t.Fatal("cannot decrypt secret")
	}
	if openSecret(sealed, []byte("wrong key")) != "" {
		t.Fatal("wrong key accepted")
	}
}
