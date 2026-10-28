# Інфраструктура: акаунти, сервіси, посилання

Довідник про те, де що розгорнуто, для чого, і де це змінювати. Покрокова інструкція першого деплою — [DEPLOY.md](DEPLOY.md). **Паролі й рядки підключення в цей файл не записуємо** (див. розділ «Секрети»).

## Схема

```
Браузер / PWA
   │  https://grade-expectations.rilhad1.workers.dev
   ▼
Cloudflare Worker ── статика веба (apps/web/dist)
   │  запити /api/*  (worker/index.js)
   ▼
Render: ge-api (Node, Fastify) ── https://ge-api.onrender.com
   │  DATABASE_URL
   ▼
Neon: Postgres (проєкт bold-sound-92852181, база grade-expectations)
```

Веб і API для браузера — один origin, тому cookie сесії першопартійні, CORS не потрібен.

## Акаунти й сервіси

Усі акаунти створено через GitHub-вхід або e-mail `rilhad1@gmail.com`, картка не прив'язувалась.

| Сервіс         | Навіщо                       | Де відкрити                                                                            | Що там налаштовано                                                                                           |
| -------------- | ---------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **GitHub**     | Код, джерело для автодеплою  | [github.com/rilhad1/grade-expectations](https://github.com/rilhad1/grade-expectations) | Гілка `main`; кожен `git push` запускає збірку на Render і Cloudflare                                        |
| **Neon**       | База даних Postgres          | [console.neon.tech](https://console.neon.tech)                                         | Проєкт `bold-sound-92852181`, гілка `production`, база `grade-expectations`, пряме з'єднання (без `-pooler`) |
| **Render**     | Сервер API (Node)            | [dashboard.render.com](https://dashboard.render.com)                                   | Сервіс `ge-api` (Blueprint з `render.yaml`), план Free, регіон Frankfurt                                     |
| **Cloudflare** | Хостинг веба + проксі `/api` | [dash.cloudflare.com](https://dash.cloudflare.com) → Compute → Workers & Pages         | Worker `grade-expectations` (конфіг `wrangler.jsonc`), піддомен акаунта `rilhad1`                            |

Сторінки документації провайдерів: [Neon docs](https://neon.tech/docs), [Render docs](https://render.com/docs), [Cloudflare Workers docs](https://developers.cloudflare.com/workers/).

## Змінні середовища

### Render (`ge-api` → Environment)

| Змінна               | Значення                                         | Звідки                                                                         |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `DATABASE_URL`       | Рядок підключення Neon (`...?sslmode=require`)   | Neon → Connect, без `-pooler`                                                  |
| `WEB_ORIGIN`         | `https://grade-expectations.rilhad1.workers.dev` | Адреса сайту; без слеша. Має збігатися з адресою в браузері, інакше вхід падає |
| `BETTER_AUTH_SECRET` | Випадковий секрет                                | Згенерував Render; не змінювати без потреби, бо розлогінить усіх               |
| `NODE_ENV`           | `production`                                     | `render.yaml`                                                                  |
| `JOBS_DRIVER`        | `inline`                                         | `render.yaml`: фонові задачі в процесі API                                     |
| `API_PORT`           | `10000`                                          | `render.yaml`                                                                  |

Необов'язкові: `GOTENBERG_URL` (PDF-відомості), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (вхід через Google; redirect URI `${WEB_ORIGIN}/api/v1/auth/callback/google`).

### Cloudflare

Секретів немає. Адреса API записана в `wrangler.jsonc` (`vars.API_ORIGIN`); змінили адресу Render, то змініть її там і зробіть `git push`.

## Секрети

- Рядок підключення Neon і демо-пароль лежать **локально** у `.env.neon` (корінь репозиторію, у `.gitignore`, права 600). Локальна розробка використовує окремий `.env`.
- Демо-входи: `teacher@demo.local`, `dekanat@demo.local`, `both@demo.local`; пароль — `DEMO_PASSWORD` з `.env.neon`.
- Якщо пароль бази потрапив у чат чи лог, змініть його: Neon → Roles → Reset password, потім оновіть `DATABASE_URL` на Render і в `.env.neon`.

## Типові операції

**Оновити застосунок.** `git push origin main`. Render і Cloudflare збирають самі; нові міграції застосовуються при старті API.

**Нова міграція вручну** (зазвичай не потрібно):

```bash
set -a; source .env.neon; set +a
pnpm db:deploy
```

**Перезавантажити демо-дані.** Seed ідемпотентний; на віддаленій базі його (і `import-real --wipe`) захищено від випадкового запуску, потрібна `ALLOW_REMOTE_DB=1`: `ALLOW_REMOTE_DB=1 pnpm exec tsx --env-file=.env.neon prisma/seed.ts` (перед цим `pnpm db:generate && pnpm --filter @ge/shared --filter @ge/domain build`).

**Перевірити, що все живе:**

- API: `https://ge-api.onrender.com/api/v1/health` → `{"status":"ok","db":"ok"}`
- Через сайт: `https://grade-expectations.rilhad1.workers.dev/api/v1/health` (перевіряє проксі).

**Логи.** Render → `ge-api` → Logs (помилки API). Cloudflare → Workers & Pages → `grade-expectations` → Deployments / Logs (збірка й проксі). Neon → Monitoring (запити до бази).

## Обмеження безкоштовних планів

- **Render Free:** сервіс засинає після 15 хвилин без запитів; перший запит після цього триває близько хвилини. PWA працює офлайн і синхронізується, коли API прокинеться.
- **Neon Free:** 0,5 ГБ, 100 CU-годин на місяць, обчислення засинає після кількох хвилин простою (перший запит повільніший), історія відновлення лише кілька годин. Для реальних даних потрібні регулярні `pg_dump`.
- **Cloudflare Workers Free:** 100 000 запитів на день. Статичні файли не рахуються, але кожен `/api/*` проходить через Worker.
- **PDF-відомості** недоступні без Gotenberg (повертають 422); DOCX працює.
- Умови планів змінюються. Перед важливими навантаженнями перевіряйте актуальні ліміти на сторінках провайдерів.

## Якщо щось зламалося

| Симптом                                               | Імовірна причина                                          | Що робити                                                 |
| ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Вхід видає помилку про origin                         | `WEB_ORIGIN` на Render не збігається з адресою в браузері | Виправити змінну (https, без слеша), зачекати перезапуску |
| Перший запит дуже довгий                              | Прокидається Render або Neon                              | Зачекати до хвилини; це норма для Free                    |
| `/api/v1/health` через сайт дає помилку, а напряму ні | Неправильний `API_ORIGIN` у `wrangler.jsonc`              | Виправити і `git push`                                    |
| На Render збірка падає на `corepack` / `pnpm`         | Не підхопилась версія pnpm                                | Надіслати лог; запасний варіант — Dockerfile              |
| Нові зміни не з'явились                               | Не зроблено `git push` або збірка впала                   | Перевірити Deployments на Render і Cloudflare             |
