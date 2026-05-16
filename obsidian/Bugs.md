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

- 2026-05-15 — Telegram OAuth `/auth/oauth/telegram/exchange` отдавал 502: маршрут Yandex Cloud → Telegram CDN периодически роняет TCP-handshake (2 из 5), CLI curl выживает через happy-eyeballs, PHP-libcurl — нет. Фикс: `connectTimeout(5) + timeout(15) + retry(2, 500ms)` на `ConnectionException`, 502→503 + `Retry-After`. См. журнал.
- 2026-05-15 — После фикса token exchange — та же сетевая нестабильность на JWKS endpoint, `5002ms` connect timeout × 3 retry = `id_token verify failed`. Фикс: кэш JWKS в Redis на 1 час через `AuthController::fetchTelegramJwks`, force-refresh при `JWT::UnexpectedValueException`.
- 2026-05-15 — GHA workflow показывал success, но `docker restart fk_app` не вызывался: `bash -s <<'REMOTE'` прокидывает скрипт через stdin ssh, а `docker compose exec -T` потребляет stdin (даже без TTY). Первый exec съедал остаток heredoc'а → bash EOF → workflow success без рестарта. Фикс: `< /dev/null` для каждой `docker compose exec`. Из-за этого бага все backend-правки c 2026-05-07 деплоились, но не применялись в живом `php artisan serve`.
- 2026-05-15 — `/verify-email` редиректил OAuth-юзеров с pending email обратно на `/account/profile` (охранник `user.email === null`). Юзеру некуда было ввести код. Фикс: `serializeUser` отдаёт `pending_email`, охранник пропускает если pending есть; плашка про код на profile теперь переживает refresh.
- 2026-05-15 — OAuth-юзер указал неверный email, не мог сменить (старый код от kkk@ru.ru оставался валидным в БД). Фикс: `EmailVerification::issue` инвалидирует все unused verification'ы юзера перед созданием новой. Плюс на `/verify-email` добавлена ссылка «Указать другой» → `/account/profile?need=email`.
- 2026-05-15 — `/api/me` (и любой auth-only `/api/*`) без Bearer возвращал HTTP 500 + `Route [login] not defined`. Фикс: `AppServiceProvider::boot` регистрирует `renderable(AuthenticationException)` который для API-запросов отдаёт JSON 401.
- 2026-05-16 — `Route [login] not defined` падал на auth-роутах при запросе без заголовка `Accept: application/json` (фикс 3e66248 закрывал только `expectsJson`-запросы). Корень: `Authenticate::redirectTo()` зовёт `route('login')` до того как exception долетает до handler'а. Фикс: `Authenticate::redirectUsing(fn () => null)` в AppServiceProvider.
- 2026-05-16 — VK-логин падал с «Подпись id_token не сошлась» (`JWKS HTTP 404`). Корень: у VK ID нет публичного JWKS endpoint'а (перепробованы все варианты `/oauth2/public_keys`, `/.well-known/*` — 404). Фикс: вместо проверки id_token по JWKS берём `access_token` и зовём `POST /oauth2/user_info` — токен добыт backend-to-backend, доверенный канал.
- 2026-05-15 — VK OAuth endpoint возвращал «error code 502» от Cloudflare. Корень: Cloudflare перехватывает 5xx от origin и подменяет тело на свою error-page. Наш код возвращал 502 при пустом id_token и не распознавал VK-ответ `200 + {"error":...}` как ошибку. Фикс: явная проверка `$resp->json('error')`, 502→422 для missing id_token в обоих провайдерах (VK + Telegram).
- 2026-05-15 — Resend verification падал с `Attempt to read property "address" on null`: `EmailVerification::issue($user)` вызывался без `new_email` → запись с `new_email=null` → `Mail::envelope()` падал у OAuth-юзеров. Плюс регресс: resend обнулял pending у OAuth-юзеров. Фикс: перед issue() достаём текущий pending'овый new_email и передаём; если нет ни pending, ни user->email — 422.
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
