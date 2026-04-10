.PHONY: dev dev-clean build lint test db-migrate db-seed docker-up docker-down clean \
       lint-api lint-web build-api build-web test-api

# ─── Desarrollo ──────────────────────────────────────────
## Levanta API + Web + Worker (requiere PostgreSQL + Redis corriendo)
dev:
	pnpm dev

## Desarrollo con limpieza de cache .next
dev-clean:
	pnpm dev:clean

# ─── Build ───────────────────────────────────────────────
## Build completo (API + Web)
build:
	pnpm build

build-api:
	pnpm --filter @sophia/api build

build-web:
	pnpm --filter @sophia/web build

# ─── Lint ────────────────────────────────────────────────
## Lint completo
lint:
	pnpm --filter @sophia/api lint
	pnpm --filter @sophia/web lint

lint-api:
	pnpm --filter @sophia/api lint

lint-web:
	pnpm --filter @sophia/web lint

# ─── Tests ───────────────────────────────────────────────
test:
	pnpm test

test-api:
	pnpm --filter @sophia/api test

# ─── Base de datos ───────────────────────────────────────
db-migrate:
	pnpm db:migrate

db-seed:
	pnpm db:seed

# ─── Docker ──────────────────────────────────────────────
docker-up:
	docker compose up -d

docker-down:
	docker compose down

# ─── Limpieza ────────────────────────────────────────────
clean:
	pnpm clean
