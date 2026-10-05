# Grade Expectations

Електронний журнал і розклад фахового коледжу (PWA). Концепція — [docs/concept.md](docs/concept.md), план — [docs/PLAN.md](docs/PLAN.md), фази — [docs/ROADMAP.md](docs/ROADMAP.md).

## Вимоги

- Node 22 (`.nvmrc`), pnpm 12 (`npm i -g pnpm@12.9.1`; якщо corepack-shim ламається, переконайся, що глобальний `pnpm` стоїть у `PATH` раніше за `/usr/local/bin`)
- PostgreSQL 16: або Docker (`docker compose`), або локальний сервер (`brew install postgresql@16`)

## Запуск

```bash
pnpm install
cp .env.example .env
pnpm dev          # Postgres у Docker + api (:3000) + web (:5173)
pnpm dev:apps     # лише api і web, якщо Postgres уже запущено локально
```

Демо-вхід після `pnpm db:seed`: `teacher@demo.local`, `dekanat@demo.local`, `both@demo.local`, пароль — `DEMO_PASSWORD` з `.env`. Вхід через Google вмикається змінними `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Перевірка: `curl localhost:3000/api/v1/health` → `{"status":"ok","db":"ok"}`. OpenAPI: `/api/v1/openapi.json`.

Локальний Postgres без Docker:

```bash
brew services start postgresql@16
createuser -s ge 2>/dev/null; psql postgres -c "ALTER USER ge PASSWORD 'ge'"
createdb -O ge ge; createdb -O ge ge_test
```

## Скрипти

| Команда           | Дія                                  |
| ----------------- | ------------------------------------ |
| `pnpm typecheck`  | перевірка типів у всіх пакетах       |
| `pnpm lint`       | ESLint (strict-type-checked) по репо |
| `pnpm test`       | Vitest у всіх пакетах                |
| `pnpm build`      | збірка пакетів і застосунків         |
| `pnpm db:migrate` | нова міграція Prisma (dev)           |
| `pnpm db:deploy`  | застосувати міграції                 |
| `pnpm db:seed`    | демо-дані (ідемпотентно)             |
| `pnpm db:reset`   | скинути БД                           |
| `pnpm format`     | Prettier                             |

## Структура

- `apps/api` — Fastify 5 (`@ge/api`)
- `apps/web` — React 19 + Vite PWA (`@ge/web`)
- `packages/shared` — Zod-схеми й типи (`@ge/shared`)
- `packages/domain` — чисті доменні функції (`@ge/domain`)
- `docker/` — Compose; `docs/` — концепт, план, рішення, відкриті питання

Коміти — Conventional Commits (перевіряє commitlint).
