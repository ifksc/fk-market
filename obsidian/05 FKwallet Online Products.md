---
tags: [проект/FK.market, документация, поставщики, FKwallet]
status: ТЗ согласовано, идёт реализация
---

## Финальные решения по 5 вопросам (2026-05-08)

1. **public_key** — в `.env` (`FKWALLET_OP_KEY`)
2. **currency_id** — `1` (RUB)
3. **Картинки** — пока URL FK (вариант A); после обкатки — переключить на скачивание (B)
4. **Категории** — товары подключаем **вручную** в админке. Дополнительно: предусмотреть автосинхронизацию остатков и пометку «нет в наличии у поставщика» (через периодический пересмотр поля `last_seen_at` в provider_products + при выдаче — `validate` перед `create`)
5. **Базовый URL** — `https://api.fkwallet.com/v1/`



# ТЗ: интеграция FKwallet Online Products API

API позволяет нам **импортировать чужой каталог** цифровых товаров и **продавать их через нашу витрину**, делегируя выдачу самому FKwallet. Подходит для гибридной схемы (наш каталог + товары из FK).

## Что даёт API

| Метод | Что делает |
|---|---|
| `GET /{public_key}/op/categories` | Дерево категорий (с parent_id, slug, name_ru/en) |
| `GET /{public_key}/op/categories/{cat_id}/products` | Список товаров в категории: id, name, description, **logo (URL картинки)**, price, currency, **fields** — параметры от покупателя |
| `POST /{public_key}/op/validate` | Проверить параметры заказа до создания (бесплатно) |
| `POST /{public_key}/op/create` | Создать заказ → ответ содержит `coupon_code` (это и есть выдача) |
| `GET /{public_key}/op/status/{order_id}` | Polling статуса заказа |

Авторизация — `public_key` в URL, всё. Простая схема.

---

## Как ляжет на нашу схему

Архитектура у нас уже под это готова — поля `fulfillment_mode='api'` и `provider_id` в `products`, таблица `provider_products` для связи внешних товаров с нашими, `fulfillment_tasks` для асинхронной выдачи.

### 1. Каталог поставщика — отдельно от нашего

Одна и та же таблица `provider_products` хранит «сырой» каталог FK + связь с нашими товарами:

```
provider_products
├── provider_id        → fkwallet
├── external_id        → online_product_id из FK
├── product_id         → наш Product (NULL пока админ не подключил)
├── raw_meta (JSON)    → name_ru, description_ru, help_description_ru,
│                        logo, help_image, fields[], category_id, slug,
│                        sort, currency
├── price_in           → price из FK (закупочная)
├── in_stock           → NULL (FK не знает остаток, считаем безлимит)
└── last_seen_at       → когда последний раз видели в синке
```

**Категории FK** не зеркалим в нашу таблицу `categories`. Информация о category_id хранится в `raw_meta`, а в нашем каталоге товар попадает в **нашу** категорию, которую админ выбирает при подключении.

### 2. Синхронизация каталога

Команда: `php artisan providers:sync fkwallet [--category=ID]`.

Выполняется:
- по cron'у (раз в час, например)
- по кнопке «Синхронизировать» в админке
- вручную из консоли

Шаги:
1. `GET /op/categories` → запоминаем дерево в `providers.settings.categories_cache` (JSON) — для UI выбора при просмотре каталога
2. Для каждой категории: `GET /op/categories/{id}/products` → upsert в `provider_products` по `(provider_id, external_id)`
3. Помечаем `last_seen_at = now()`
4. `provider_products`, у которых `last_seen_at` старше суток (т.е. не появлялись 24+ часа), помечаем как «вышли из каталога» (можно отдельный флаг или просто `in_stock = 0`).
5. В `provider_logs` пишем результат (количество added/updated/disappeared, latency, errors).

### 3. Подключение товара поставщика к нашему каталогу

В админке появится новый раздел: **`/admin/providers/fkwallet/catalog`** — таблица `provider_products` для FK-провайдера, с фильтрами:
- Все / Уже подключённые / Не подключённые
- Поиск по названию
- Фильтр по категории провайдера

По клику «Подключить» открывается **форма создания товара** в нашем каталоге, **предзаполненная** данными из FK:

| Поле в нашей БД | Берётся из FK |
|---|---|
| `name` | `name_ru` |
| `slug` | `slug` (с префиксом `fkwallet-`) |
| `short_description` | `description_ru` (трим до 500) |
| `description` | `description_ru` + `\n\n` + `help_description_ru` |
| `category_id` | **админ выбирает вручную** из нашего списка |
| `price_base` | `price` (закупка) |
| `markup_pct` | NULL (берётся из глобальных правил) |
| `currency` | `currency` |
| `fulfillment_mode` | `api` |
| `fulfillment_fallback` | `manual` (если FK не отвечает — админ решает руками) |
| `provider_id` | id записи fkwallet в `providers` |
| `provider_external_id` | `external_id` (= online_product_id) |
| `required_params` | конвертируем из `fields[]` (см. ниже) |

После сохранения связь записывается обратно: `provider_products.product_id = новый_product.id`, и товар появляется на витрине (после смены status на `active`).

**Конвертация fields → required_params:**

```
FK: { key: "Input1", placeholder: "Логин Steam", values: [], info: ["мин 5 символов"] }
↓
наш: { name: "Input1", label: "Логин Steam", type: "string", required: true, hint: "мин 5 символов" }
```

Если `values` непустой массив → у нас `type: "select"` с этим списком.

### 4. Выдача товара (`fulfillment_mode=api`)

Сейчас в `FulfillOrderJob` для режима `api` стоит заглушка (создаём manual-задачу). Дополним:

```
FulfillOrderJob → для каждого order_item с fulfillment_mode='api':
  1. Создать FulfillmentTask(mode=api, status=in_progress, deadline_at=+10 мин)
  2. POST /op/validate с idempotence_key="FK-2026-XXXXX-{item_id}"
     ├── ok    → следующий шаг
     └── fail  → провайдер_logs.error, fallback на manual
  3. POST /op/create с теми же параметрами
     ├── data.coupon_code сразу пришёл → готово, см. шаг 5
     ├── data.status="pending"         → polling, см. шаг 4
     └── error                          → fallback на manual
  4. Polling /op/status/{order_id} с экспоненциальным backoff (5с, 10с, 20с, до 5 мин):
     ├── status=success + coupon_code → шаг 5
     ├── status=fail                    → fallback на manual
     └── timeout                        → fallback на manual (админ разберётся)
  5. Записываем coupon_code в order_item.delivered_payload (зашифрованно)
     fulfillment_status=delivered, FulfillmentTask.status=done
     Email с кодом → клиенту
```

Все запросы к FK API логируются в `provider_logs` (request, response, latency, success).

**Идемпотентность:** ключ `idempotence_key = "FK-2026-XXXXX-{order_item.id}"`. Если retry — отправляем тот же ключ, FK не создаст дубль.

### 5. Картинки

FK даёт `logo` (URL) и `help_image` (URL инструкции по активации). Варианты:

**Вариант A — хранить URL** (просто, но зависим от их CDN). Если URL умрёт — у нас «битая картинка».
**Вариант B — скачивать при импорте** в наш `storage/app/public/products/` или в S3. Надёжнее, медленнее синк.
**Вариант C — lazy proxy** — наш URL `/img/proxy?u=…` который при первом обращении скачивает и кэширует.

→ См. **открытый вопрос #3** ниже.

### 6. Цена и валюта

- `price` из FK — это **закупочная** цена в базовой валюте (обычно USD или RUB).
- `currency` — код (`USD`, `RUB`, и т.п.).
- `currency_id` (числовой) — нужен для запросов validate/create. У FK обычно `1` или `643` для RUB. → **открытый вопрос #2**.
- Наша витринная цена `price_final = price_base × (1 + markup_pct/100)`, по правилам из `pricing_rules`.

Если FK отдаёт цену в USD — нам надо конвертировать в RUB при импорте (по курсу из `settings.usd_rate`?), или хранить как есть и пересчитывать на лету. Скорее всего FK даёт сразу в выбранной нами валюте — в API есть `currency_id` параметр.

### 7. Хранение `public_key`

В таблице `providers.credentials` (Crypt-encrypted). Админ задаёт через UI «Поставщики → fkwallet → Настроить» — поле уже сделано.

В `providers.settings` (JSON) храним:
- `default_currency_id` (например 1)
- `categories_cache` (после последней синки — для быстрого UI)
- `auto_sync` (bool — синхронизировать по cron'у)

### 8. Безопасность

- `public_key` шифруется
- Логи `provider_logs` не содержат полный URL с ключом — маскируем
- Webhook'и от FK об оплате — не трогаем (мы используем Free-Kassa Acquiring отдельно для приёма денег)

---

## Какие изменения в коде потребуются

**Backend (новое):**
- `app/Services/Providers/ProviderGateway.php` — интерфейс
- `app/Services/Providers/FKwalletProductsGateway.php` — реализация (5 методов)
- `app/Console/Commands/ProvidersSyncCommand.php` — `php artisan providers:sync`
- `app/Jobs/FulfillViaApiJob.php` — асинхронная выдача с polling'ом
- `app/Http/Controllers/Api/Admin/ProviderCatalogController.php` — список provider_products + действие «подключить»

**Backend (правки):**
- `FulfillOrderJob` — для api-режима не создавать manual-задачу, а ставить `FulfillViaApiJob`

**Frontend (новое):**
- `/admin/providers/{id}/catalog/page.tsx` — таблица provider_products с фильтрами
- `/admin/providers/{id}/catalog/[external_id]/connect/page.tsx` — форма подключения товара (предзаполненные поля)
- В разделе `/admin/providers/{id}` — добавить кнопку «Синхронизировать каталог» и метрики (товаров всего / подключено / не подключено)

**Сидер:**
- В `DatabaseSeeder` добавить запись провайдера `fkwallet` (если её нет): `code='fkwallet'`, `name='FKwallet Online Products'`, `base_url='https://api.fkwallet.com'` (точный домен — **открытый вопрос #5**).

---

## Открытые вопросы (нужны твои ответы)

1. **Как хранить `public_key`** — в `providers.credentials` через UI админки (рекомендую), или в `.env` (`FKWALLET_OP_KEY`)? **Через UI правильнее** — можно менять без редеплоя.

2. **`currency_id` для RUB** — `1`, `643` или другое? Если в твоём ЛК есть список валют — пришли скриншот / список. Если нет — попробуем `1` и при ошибке скорректируем.

3. **Картинки товаров** — выбираем из A/B/C выше:
   - **A** — URL FK (быстро, риск битых картинок)
   - **B** — скачивать при синке в локальное хранилище / S3 (надёжно)
   - **C** — lazy-прокси через наш сервер с кэшем
   
   Я бы пока сделал **A**, при росте каталога переключим на **B**.

4. **Категории FK** — оставляем «их» структуру только в `raw_meta` (админ подключает товар вручную с выбором нашей категории), или сделать автомаппинг по slug-у? Я бы делал **вручную** — больше контроля, нет случайных ошибок.

5. **Базовый URL API FKwallet** — в твоей доке указано `/{public_key}/op/...`. Но это относительный путь. Какой полный URL? Похоже что-то вроде `https://api.fkwallet.com/v1/...` или `https://api.freekassa.com/v1/...`. Пришли точный домен из твоей доки или из ответа saved-curl'а в их Postman collection.

---

## Что делаю после твоих ответов

1. Создаю интерфейс `ProviderGateway` и `FKwalletProductsGateway` (5 методов).
2. Пишу команду `php artisan providers:sync fkwallet`.
3. Дописываю `FulfillOrderJob` под api-режим (с polling'ом и fallback).
4. Делаю UI в админке: страница каталога поставщика и форма подключения.
5. Тестируем на одном товаре от FK (например, пополнение Steam) — добавляем, синхронизируем, подключаем, продаём, видим что код выдан.
