# Деплой на безкоштовних сервісах

Схема: **Neon** (Postgres) ← **Render** (API) ← **Cloudflare Workers** (веб + проксі `/api`).

Веб і API для браузера — один origin: Cloudflare Worker (`worker/index.js`) пересилає `/api/*` на Render. Через це cookie сесії першопартійні, CORS не потрібен.

> Умови безкоштовних планів змінюються — перед стартом гляньте актуальні ліміти на сторінках провайдерів.
> Файли `render.yaml` і Pages Function написані без запуску на реальних сервісах: перший деплой перевіряйте за кроком 6.

## 0. Підготовка

1. Код має бути на GitHub: `git push origin main` (репозиторій `rilhad1/grade-expectations`).
2. Облікові записи (картка не потрібна): [Neon](https://neon.tech), [Render](https://render.com), [Cloudflare](https://dash.cloudflare.com). Реєструйтеся через GitHub.
3. Знадобиться випадковий секрет: `openssl rand -base64 32` (Render може згенерувати сам — див. крок 3).

## 1. База даних (Neon)

1. Create project → назва `grade-expectations`, регіон найближчий до Render (Frankfurt), Postgres 16 або новіший.
2. На Dashboard натисніть **Connect**, вимкніть перемикач **Connection pooling** (потрібне пряме з'єднання, не `-pooler`) і скопіюйте рядок вигляду
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Збережіть його — це `DATABASE_URL`.

## 2. Міграції й демо-дані (з вашого комп'ютера, один раз)

```bash
export DATABASE_URL='<рядок з Neon>'
pnpm db:deploy                                  # застосувати міграції
printf 'DATABASE_URL=%s\nDEMO_PASSWORD=<ваш пароль>\n' "$DATABASE_URL" > /tmp/neon.env
pnpm db:generate && pnpm --filter @ge/shared --filter @ge/domain build
pnpm exec tsx --env-file=/tmp/neon.env prisma/seed.ts   # демо-дані: 75 студентів, навантаження, розклад
rm /tmp/neon.env
```

Демо-входи після seed: `teacher@demo.local`, `dekanat@demo.local`, `both@demo.local`; пароль — ваш `DEMO_PASSWORD` (мінімум 8 символів). Для реального коледжу замість seed користувачів і довідники вносить деканат в застосунку.

## 3. API (Render)

1. Render Dashboard → **New → Blueprint** → оберіть репозиторій; Render прочитає `render.yaml` і створить сервіс `ge-api` (план Free, регіон Frankfurt).
2. Коли попросить значення змінних:
   - `DATABASE_URL` — рядок з Neon (крок 1);
   - `WEB_ORIGIN` — адреса Pages (крок 4), наприклад `https://ge-web.pages.dev`. Її ще немає — введіть поки `https://ge-web.pages.dev` і поправте на справжню після кроку 4;
   - `BETTER_AUTH_SECRET` Render згенерує сам.
3. Дочекайтеся першої збірки (5–10 хвилин). Стартова команда сама виконує `prisma migrate deploy`.
4. Перевірте: `https://<ім'я>.onrender.com/api/v1/health` має повернути `{"status":"ok","db":"ok"}`. Запишіть цю адресу — це `API_ORIGIN`.

Безкоштовний сервіс засинає через 15 хвилин без запитів, перший запит після цього триває близько хвилини. Для PWA це терпимо: офлайн-кеш і черга синхронізації працюють.

## 4. Веб (Cloudflare Workers)

Cloudflare тепер створює застосунки як Workers зі статикою; конфіг лежить у `wrangler.jsonc`, проксі — у `worker/index.js`.

1. Compute → Workers & Pages → Create application → Import a repository (GitHub) → `grade-expectations`.
2. Project name: `grade-expectations` (збігається з `name` у `wrangler.jsonc`).
3. Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ge/shared --filter @ge/domain build && pnpm --filter @ge/web exec vite build`
4. Deploy command: `npx wrangler deploy` (за замовчуванням). Версія Node береться з `.nvmrc`.
5. Адресу API записано в `wrangler.jsonc` (`vars.API_ORIGIN`); змінюйте її там.
6. Після деплою адреса сайту — `https://grade-expectations.<ваш-піддомен>.workers.dev`.

## 5. Зв'язати все докупи

1. Render → `ge-api` → Environment → `WEB_ORIGIN` = точна адреса Pages із кроку 4 (https, без слеша). Збережіть — сервіс перезапуститься.
2. Якщо кастомний домен — той самий домен у `WEB_ORIGIN`.

## 6. Перевірка першого деплою

1. Відкрийте адресу Pages, увійдіть як `teacher@demo.local`. Якщо вхід падає з помилкою про origin — `WEB_ORIGIN` не збігається з адресою в рядку браузера.
2. `https://<pages>/api/v1/health` має віддати `ok` (перевіряє проксі).
3. Відкрийте «Сьогодні», «Журнал», виставте оцінку, вимкніть мережу в DevTools і перевірте офлайн-режим та синхронізацію.
4. Встановіть застосунок як PWA (іконка в адресному рядку).

## 7. Що не працює безкоштовно / обмеження

- **PDF-відомості**: Gotenberg безкоштовно ніде не підняти; без `GOTENBERG_URL` API віддає 422 на PDF, DOCX працює.
- **Вхід через Google**: необов'язково; змінні `GOOGLE_CLIENT_ID/SECRET`, redirect URI `${WEB_ORIGIN}/api/v1/auth/callback/google`.
- **Фонові задачі** виконуються в процесі API (`JOBS_DRIVER=inline`), окремої черги немає.
- **Neon** вимикає обчислення після ~5 хвилин простою; перший запит після цього повільніший. Ліміт: 0,5 ГБ і 100 CU-годин на місяць.
- **Бекапи**: Neon Free зберігає історію лише кілька годин. Для реальних даних робіть `pg_dump` за розкладом.

## 8. Оновлення

`git push origin main` → Render і Pages збирають нову версію самі. Нові міграції застосовуються при старті API.
