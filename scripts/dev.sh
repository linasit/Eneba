#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then set -a; source .env; set +a; fi
: "${DATABASE_URL:?Create .env from .env.example and configure DATABASE_URL}"
: "${JWT_SECRET:?Configure JWT_SECRET in .env}"
export DATABASE_URL JWT_SECRET
export APP_ORIGIN="${APP_ORIGIN:-http://127.0.0.1:5173}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
go run ./cmd/server &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev --prefix web
