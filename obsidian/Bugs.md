# Bugs

Чек-лист открытых багов и история закрытых. Формат:

```
- [ ] **Краткое описание** — где, когда замечено
  - Шаги/воспроизведение: …
  - Подозрение: …
  - Дата: 2026-05-14
```

Когда баг исправлен — переносим в раздел «Закрытые» с одной строкой про фикс и дату.

---

## 🔥 Открытые

_Пусто_

---

## ✅ Закрытые

<details>
<summary>История фиксов</summary>

- 2026-05-13 — Webhook Freekassa возвращал 405 (FK слал GET для проверки URL). Фикс: `Route::match(['get','post'])` + контроллер отвечает `YES` на пустой запрос.
- 2026-05-13 — `payments.provider` был ENUM, не давал писать `freekassa`. Фикс: ALTER COLUMN VARCHAR(60), миграция 2026_05_13_000004.
- 2026-05-13 — Webhook упирался в IP whitelist (сервер за Cloudflare). Фикс: брать `CF-Connecting-IP` вместо `request->ip()`.
- 2026-05-13 — `amount mismatch` 61 vs 61.00 (number_format vs raw). Фикс: сравнение через `abs(float - float) > 0.01`.
- 2026-05-13 — FK validate возвращает `[]` вместо `{"status":"ok"}`, выдача падала с `Provider validate() returned false`. Фикс: считать 200 OK как успех. Плюс обработка `409 Duplicate idempotence key` как «уже валидно».
- 2026-05-13 — Polling в FulfillViaApiJob не понимал числовой статус FK = 1 (success), товары типа Telegram Звёзд (без coupon_code) уходили в timeout. Фикс: `classifyStatus()` + cron `op:check-pending`.
- 2026-05-13 — Спец-товары без `provider_external_id` и без `variant_select` (Пополнение Steam) уезжали в draft автосинком. Фикс: ProductRefresher пропускает такие.
- 2026-05-13 — Webhook FK висел до 5+ мин (QUEUE=sync), фронт ловил 504 на `/api/payments/fkwallet/check`. Фикс: `QUEUE_CONNECTION=database`, контейнер `fk_worker` с `php artisan queue:work`, jobs обрабатываются в фоне.
- 2026-05-14 — Автосинк FKwallet обновлял `provider_products`, но не создавал наши `Product`'ы (это делала только ручная кнопка «Подключить все»). Фикс: в `ProvidersSyncCommand` добавлен шаг `ProductGrouper::default()->groupAll($provider, ['status' => 'active'])`. Управляется флагом `provider.settings.auto_connect_new_products` (default true). Заодно поймали: `app(ProductGrouper::class)` подсовывал пустой `Seller` через DI — нужен именно `::default()`, который тянет `Seller::where('slug','platform')`.
- 2026-05-14 — При первом `git init` папка `frontend/` была закоммичена как submodule (Next.js при `create-next-app` сделал внутри свой `.git/`), на GitHub попала «ссылка на коммит» вместо файлов, CI не мог синкать фронт. Фикс: `rm -rf frontend/.git`, `git rm --cached -f frontend`, `git add frontend` — теперь это обычная папка. Backend такой проблемы не имел.

</details>
