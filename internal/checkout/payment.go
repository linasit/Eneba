package checkout

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
)

type PaymentProvider interface {
	Charge(amountCents int, currency, cardNumber string) (ref string, err error)
}

// MockProvider: no real money is ever moved.
//
//	4242 4242 4242 4242 -> success
//	4000 0000 0000 0002 -> declined
type MockProvider struct{}

func (MockProvider) Charge(amount int, cur, card string) (string, error) {
	switch strings.ReplaceAll(card, " ", "") {
	case "4242424242424242":
		return fmt.Sprintf("mock_pi_%d", rand.Int63()), nil
	case "4000000000000002":
		return "", errors.New("card declined (test card)")
	default:
		return "", errors.New("use a test card: 4242 4242 4242 4242")
	}
}
