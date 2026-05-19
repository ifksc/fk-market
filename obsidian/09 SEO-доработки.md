---
tags: [проект/FK.market, ТЗ, SEO]
---

# ТЗ — SEO-доработки (по внешнему аудиту)

**Источник:** внешний SEO/security-аудит, 11 пунктов (нумерация аудита
сохранена; пункт 4 в исходнике отсутствовал).
**Статус:** разбор завершён 2026-05-19, код не начат.

## 0. Сводка разбора (сверено с кодом)

| # | Пункт аудита | Реальность | Приоритет |
|---|--------------|-----------|-----------|
| 1 | noindex на /login, /admin, /account, /cart | ⚠️ подтверждено — meta нет | **High** |
| 2 | /admin отдаёт 200, закрыть авторизацией/404 | ✅ авторизация уже есть, утечки нет | — (закрыт п.1) |
| 3 | /support — нет canonical, дефолтный title | ⚠️ подтверждено | **High** |
| 5 | Перевести картинки на next/image | 🟡 переоценено — витрина уже на next/image | Low |
| 6 | lazy loading картинок | 🟡 переоценено — next/image грузит lazy сам | Low |
| 7 | Длинный title статьи блога (74 симв.) | ⚠️ подтверждено | Medium |
| 8 | Canonical главной без trailing slash | ✅ уже с `/` — `https://fk.market/` | — (сделано) |
| 9 | CSP перевести из Report-Only в enforce | ⚠️ подтверждено | Medium |
| 10 | Slug-дубль `death-stranding-…-2` | ⚠️ подтверждено (данные) | Medium |
| 11 | font-display: swap | ✅ уже есть (`next/font`, `display:'swap'`) | — (сделано) |

**Уже сделано (пункты 8, 11)** — работ не требуют, см. §6.
**Переоценено (пункты 2, 5, 6)** — см. §5, объём минимальный/опциональный.
**К реализации:** пункты 1, 3, 7, 9, 10 — §§1–4 ниже.

---

## 1. noindex на приватных страницах (пункт 1 + 2) — High

**Проблема.** `/login`, `/cart`, `/account/**`, `/admin/**`, `/checkout`,
`/forgot-password`, `/reset-password`, `/verify-email` — закрыты только
`robots.txt Disallow` (`app/robots.ts`). Disallow запрещает обход, но НЕ
гарантирует исключение из индекса (страница может попасть в индекс по
внешним ссылкам). Нужен `<meta name="robots" content="noindex,nofollow">`.

Все эти страницы — `'use client'`-компоненты и **не могут** экспортировать
`metadata` напрямую. Решение — серверный `layout.tsx` в каждом разделе:
он экспортирует `metadata`, метатег каскадно применяется ко всем вложенным
страницам.

**Задачи:**
- Новый `app/account/layout.tsx` (server) — `export const metadata = { robots: { index: false, follow: false } }`, рендерит `{children}`. Покрывает все `/account/*`.
- Аналогично новые: `app/cart/layout.tsx`, `app/checkout/layout.tsx`, `app/login/layout.tsx`, `app/forgot-password/layout.tsx`, `app/reset-password/layout.tsx`, `app/verify-email/layout.tsx` (тривиальные ~6-строчные файлы).
- `/admin`: `app/admin/layout.tsx` сейчас `'use client'` (логика токена/редиректа) — экспортировать `metadata` не может. Рефактор: сделать `app/admin/layout.tsx` серверным (экспорт `metadata` с noindex + рендер дочернего клиентского шелла); текущую клиентскую логику вынести в `components/admin/AdminShell.tsx` (`'use client'`). Это самая объёмная подзадача пункта.

**Пункт 2 аудита** («/admin отдаёт 200 — закрыть авторизацией/404»):
проверено — авторизация уже есть. `AdminLayout` на маунте проверяет токен,
при отсутствии/ошибке редиректит на `/admin/login`; данные тянутся из
`/api/admin/*`, который закрыт IP-allowlist + auth. Неавторизованный гость
видит только лоадер и редирект — **утечки данных нет**. Возврат 404 для
client-rendered SPA нецелесообразен. Остаётся только вопрос видимости в
индексе — закрывается `noindex` выше. **Отдельных работ пункт 2 не требует.**

**Файлы:** 7 новых `layout.tsx` + рефактор `app/admin/layout.tsx` →
`components/admin/AdminShell.tsx`.

---

## 2. SEO-мета для /support (пункт 3) — High

**Проблема.** `app/support/page.tsx` — `'use client'`, `metadata` не
экспортирует → наследует дефолтные `title`/`description` корневого layout
и **не имеет `canonical`**.

**Решение.** Новый серверный `app/support/layout.tsx` с `metadata`:
- `title` — уникальный, напр. «Поддержка — помощь по заказам и оплате»;
- `description` — уникальное, ~150–160 символов;
- `alternates: { canonical: '/support' }`;
- `openGraph` по аналогии с другими страницами.

**Файл:** новый `app/support/layout.tsx`.

---

## 3. Длинный title статьи блога (пункт 7) — Medium

**Проблема.** `app/blog/[slug]/page.tsx` `generateMetadata` ставит
`title: post.title`, корневой шаблон `template: '%s — FK.market'`
добавляет ` — FK.market`. Длинные заголовки статей (пример: 74 символа)
обрезаются в выдаче.

**Решение — отдельное SEO-поле у статьи** (правильный путь: H1 на странице
и title в выдаче — разные тексты):
- **Backend:** миграция — колонка `blog_posts.meta_title` (nullable string ~70). Модель `BlogPost` — добавить в `$fillable`. `Admin/BlogController` — валидация (`nullable|string|max:70`) + сохранение; в публичную выдачу статьи (`BlogController` public) добавить `meta_title`.
- **Админка:** в `components/admin/BlogEditor.tsx` — поле «SEO-заголовок (title)» с подсказкой/счётчиком символов «оптимально ≤ 60»; пусто → используется обычный заголовок.
- **Фронт:** `app/blog/[slug]/page.tsx` `generateMetadata` — если `meta_title` задан, ставить `title: { absolute: post.meta_title }` (автор сам контролирует, суффикс ` — FK.market` не добавляется); иначе прежнее поведение (`title: post.title` + шаблон).
- Тип `BlogPost` на фронте + `lib` — добавить `meta_title`.

**Примечание:** конкретный заголовок-пример («Как пополнить Steam…») и сам
по себе ~60 символов — это и редакторская задача (писать короче), поле
`meta_title` даёт инструмент.

**Файлы:** миграция, `BlogPost.php`, `Admin/BlogController.php`,
`BlogController.php` (public), `BlogEditor.tsx`, `app/blog/[slug]/page.tsx`,
типы блога во фронте.

---

## 4. CSP: Report-Only → enforce (пункт 9) — Medium

**Проблема.** `next.config.ts` отдаёт `Content-Security-Policy-Report-Only`
— браузер только логирует нарушения, не блокирует. Защита не работает.

**Текущая политика** (`next.config.ts:15-28`) — умеренно мягкая:
`script-src` содержит `'unsafe-inline'` + домены GA/Yandex; `img-src https:`.
Поэтому перевод в enforce низкорисковый, но требует проверки.

**План выката:**
1. Прогнать сайт по всем ключевым сценариям (каталог, товар, чекаут, ЛК,
   блог, OAuth-вход, админка) — убедиться, что текущая политика ничего
   не ломает.
2. (Опц.) добавить `report-uri`/`report-to` и собрать нарушения за
   несколько дней — сейчас отчёты Report-Only никуда не агрегируются.
3. Переименовать заголовок `Content-Security-Policy-Report-Only` →
   `Content-Security-Policy`.
4. После выката — мониторить ошибки/консоль.

**На будущее (вне scope):** уйти от `'unsafe-inline'` в `script-src` к
nonce-CSP — это сильнее, но требует доработки рендера скриптов.

**Файл:** `next.config.ts`.

---

## 5. Дедуп товара (пункт 10) — Medium, данные

**Проблема.** Slug `death-stranding-2-on-the-beach-2` — суффикс `-2`
сгенерирован `ProductSlug::make` при коллизии, т.е. существует второй товар
с тем же названием. Вероятно — тот же класс бага, что чинили в #132
(номинал/товар стал отдельной карточкой вместо варианта группы).

**Решение — данные, кодовых правок не требует:**
1. Найти оба товара и определить, что из них дубль:
   `docker exec fk_app php artisan tinker --execute="echo App\Models\Product::where('slug','like','death-stranding-2-on-the-beach%')->get(['id','slug','name','status','provider_id','provider_external_id','category_id'])->toJson(JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);"`
2. Если один — standalone-дубль варианта группы → слить командой
   `products:merge-into-group` (см. [[Журнал решений#2026-05-18]]).
3. Если простой дубль без группы → заархивировать худшую карточку
   (`status=archived`) через админку.
4. Sitemap править НЕ нужно: `app/sitemap.ts` берёт товары из публичного
   `/api/products` (scope `active()`) — архивный товар выпадает из карты сам.

---

## 6. Уже сделано — работ не требуют

- **Пункт 8 (canonical главной).** `app/layout.tsx` `metadataBase =
  https://fk.market`, `app/page.tsx` `alternates.canonical = '/'` →
  итоговый canonical `https://fk.market/` — **уже с trailing slash**.
  Замечание аудита неактуально.
- **Пункт 11 (font-display: swap).** Шрифт Inter подключён через
  `next/font/google` с явным `display: 'swap'` (`app/layout.tsx:11-15`),
  `@font-face` в CSS нет. **Уже сделано.**

---

## 7. Картинки — пункты 5, 6 (переоценено) — Low

Аудит утверждал «1 из 63 картинок на `next/image`». Факт: витрина уже на
`next/image` — `ProductCard`, `BlogCard`, секции главной. `next/image` сам
отдаёт WebP/AVIF, `srcset` и lazy-load для below-the-fold.

Остаточные сырые `<img>` (8 шт.) — почти все в **админке** (формы/превью,
не SEO-страницы) + noscript-пиксель Яндекс.Метрики (намеренно). Единственный
публичный — `components/ProductBuyBox.tsx:247` (уже с `loading="lazy"`).

**Вывод:** критичной потери нет. Опционально — перевести `ProductBuyBox`
на `next/image` (нужны фикс. размеры/`fill`). Админские `<img>` трогать
смысла нет. **Низкий приоритет, можно не делать.**

---

## 8. Предлагаемый порядок и фазы

- **Ф1 (High, быстро):** §1 noindex-лейауты (без admin-рефактора) + §2
  /support — один PR. Простые серверные `layout.tsx`, минимальный риск.
- **Ф2 (High):** admin-рефактор из §1 (`AdminShell`) — отдельный PR,
  затрагивает рабочую админку, нужен аккуратный тест.
- **Ф3 (Medium):** §3 `meta_title` для блога — backend-миграция + админка
  + фронт.
- **Ф4 (Medium):** §4 CSP enforce — после проверки сценариев.
- **§5 (дедуп)** — разовая операция с данными, можно сделать в любой момент
  параллельно.
- **§7 (картинки)** — опционально, низкий приоритет.

Каждый кодовый PR — через обязательный `/review` + `/security-review`
перед мержем.
