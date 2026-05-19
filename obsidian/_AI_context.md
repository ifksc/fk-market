---
tags: [meta, ai-context]
aliases: [AI context, контекст для ассистента]
---

# _AI_context — точка входа для AI-ассистента

> [!important] Если ты AI-ассистент (Claude) и начинаешь работать с FK.market — прочитай этот файл **первым**, до расспросов. Здесь короткая выжимка контекста + соглашения, которым следуем.

## Что это

**FK.market** — онлайн-магазин цифровых товаров на платежах Free-Kassa.
- **Прод:** https://fk.market (Yandex Cloud, IP `194.87.118.214`)
- **Репо:** `github.com/ifksc/fk-market` (private)
- **Стек:** Laravel 11 + Next.js 16 + MySQL 8 + Redis, Docker Compose
- **Архитектура заложена под v2 (мультивендорный маркетплейс)** — `seller_id` везде с v1.

## Где что лежит (в репо)

```
FK.market/
├── backend/
│   ├── custom/              ← наш слой, git-tracked, синкается через GHA
│   │   ├── controllers/ models/ migrations/ services/ jobs/ ...
│   │   ├── routes/api.php
│   │   └── config-services-*.snippet  ← документация секций services.php
│   ├── src/                 ← Laravel-проект, НЕ git-tracked
│   │   └── config/services.php   ← правится вручную на проде ⚠
│   ├── deploy/              ← bootstrap/deploy скрипты
│   ├── docker-compose.yml
│   └── .env.example
├── frontend/                ← Next.js, git-tracked целиком (кроме node_modules/.next)
│   ├── app/ lib/ components/
│   └── AGENTS.md            ← «Next.js 16 ≠ training data, читай docs»
├── design/                  ← HTML-прототипы (Tailwind, без сборки)
├── obsidian/                ← документация и журналы (ЭТА папка)
└── .github/workflows/deploy.yml  ← CI/CD
```

## Как мы деплоим

**Push в `main` → GitHub Actions:**
1. rsync `backend/custom/` → `/opt/fk.market/backend/custom/` на проде
2. SSH в прод: копирует `custom/*` → `src/app/*` соответствующие папки
3. `php artisan migrate --force` + clear cache
4. `docker restart fk_app` + `docker restart fk_worker` ← **обязательно**, потому что `php artisan serve` (CLI-сервер) держит классы в памяти
5. Если есть изменения в `frontend/` — пересборка standalone-образа Next.js

**~30 секунд от push до live.**

Знай про grabли (зафиксированы в [[Журнал решений#2026-05-15]]):
- В heredoc через `ssh ... 'bash -s' <<'REMOTE'` любая `docker compose exec` без `< /dev/null` съест остаток скрипта.
- `NEXT_PUBLIC_*` запекается в build → нужна пересборка frontend при смене.
- `services.php` правится вручную на проде, в репо лежат только `*.snippet` — это технический долг.

## Креды и секреты

**НЕ ХРАНИМ нигде в коде/документации/AI-памяти.**

Креды только в:
- `.env` на проде (backend и frontend отдельно)
- GitHub Secrets (`SSH_PRIVATE_KEY`, `DOCKER_HUB_*`)
- Личные заметки владельца (вне vault'а)

Если AI-ассистент видит реальный токен/пароль/секрет в чате — **не сохраняй** в файлы. Используй и забудь.

## Конвенции коммитов

```
fix(area): корень проблемы в одной строке

Контекст в 1-3 строки.
Что именно поменяли (если не очевидно из диффа).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Префиксы: `fix:`, `feat:`, `refactor:`, `docs:`, `chore:`, `ci:`. Без эмодзи в commit-сообщениях. Длина title ≤ 70 символов.

## Журналирование (важно)

После **каждой** закрытой задачи AI-ассистент **сам**, без напоминаний, обновляет:

| Изменение | Куда |
|---|---|
| Баг закрыт | [[Bugs]] → раздел Закрытые, одна строка про корень и фикс |
| Архитектурное решение / новая фича | [[Журнал решений]] → запись `## YYYY-MM-DD` / `### 🎯 Название` с форматом ниже |
| Изменение состояния этапа | [[Roadmap]] и/или [[Kanban]] — переставить чек-бокс |
| Изменение текущего статуса проекта | [[FK.market]] (Hub) → блок «Статус» |
| Изменение общей картины | этот файл (_AI_context) |

**Формат записи в журнале решений** (как договорились):
```markdown
### 🎯 Название решения
**Дата:** YYYY-MM-DD (опц.)
**Контекст:** почему понадобилось.
**Что сделано:** что именно и как.
**Грабли пути:** что пошло не так / неочевидные моменты.
**Что ещё впереди:** оставшиеся ниточки, технический долг.
```

Глубина — как в записях за 2026-05-15. Корень проблемы, не только симптом.

## Текущий статус

**Обновлено:** 2026-05-16

- **Прод:** работает с 2026-05-07. Полный путь покупки end-to-end через Free-Kassa.
- **Фаза:** 3 завершена. Готово: каталог/карточка/корзина/оформление, автовыдача
  `stock`/`api`/`manual`, полная админка (товары/заказы/склад/пользователи/наценки/
  промокоды/статистика/очередь/поставщики), отзывы с премодерацией, FULLTEXT-поиск,
  Яндекс.Метрика. Отложено: Digiseller/Kinguin-адаптеры (ждут доступ к API).
  Дальше — Фаза 4 (бэкапы БД, мониторинг, нагрузочный тест).
- **Авторизация:**
  - email/пароль + 6-значный код верификации ✓
  - Telegram OIDC (PKCE) ✓ на проде. Маршрут до Telegram нестабилен — retry 4×
    + stale-JWKS-кэш. Egress-прокси — план Б, в проработке (см. журнал 2026-05-16).
  - **VK ID** ✓ на проде с 2026-05-16.
  - **Яндекс ID** ✓ на проде с 2026-05-16 (профиль через login.yandex.ru/info).
  - Баг «Несовпадение state» при OAuth-логине — закрыт 2026-05-16 (ключ session
    в sessionStorage теперь включает state).
- **Auth endpoints:** `POST /api/auth/oauth/{provider}/exchange` (PKCE-flow).
  - Telegram: exchange code → id_token, верификация по JWKS (`telegram_jwks` в Redis на час).
  - VK: exchange code → access_token → `POST id.vk.com/oauth2/user_info` за профилем
    (у VK ID нет публичного JWKS — см. [[Журнал решений#2026-05-16]]).
  - Яндекс: exchange code → access_token → `GET login.yandex.ru/info` за профилем
    (чистый OAuth 2.0 без OIDC, JWKS нет — см. [[Журнал решений#2026-05-16]]).

## Технический долг (приоритет ↓)

1. **`src/config/services.php`** не git-tracked, правится вручную на проде. Вынести в `custom/config/services.php`, синкать через GHA — устранит риск потери при пересоздании сервера.
2. **`php artisan serve`** в проде вместо FPM. На каждый деплой нужен полный рестарт контейнера. Перейти на FPM-Docker — тогда `php artisan reload` или просто новые request'ы подхватят код без рестарта.
3. **`NEXT_PUBLIC_*`** в build-time → при смене client_id любого провайдера нужна пересборка frontend. Не критично, но помнить.
4. **SMTP 550** на несуществующий email проглатывается `safeSendMail` → юзер видит «отправили», письма нет. Проверять recipient до создания verification (MX-check или async статус).
5. **Sentry / мониторинг** — нет. Ошибки только в `storage/logs/laravel.log`.

_Закрыто:_ бэкапы БД — ежедневный mysqldump в S3-совместимое хранилище настроены 2026-05-19.

## SSH и диагностика

```bash
ssh deploy@194.87.118.214

# Laravel-логи (фильтруй по grep'у нужному)
docker compose -f /opt/fk.market/backend/docker-compose.yml \
  exec -T app tail -f storage/logs/laravel.log

# Состояние контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}'

# События docker за последние 5 мин (рестарты, exec'и)
docker events --since 5m --until 1s
```

**Контейнеры:** `fk_app` (Laravel), `fk_worker` (queue:work), `fk_nginx` (внутри Docker — не путать с системным), `fk_mysql`, `fk_redis`, `fk_pma` (phpMyAdmin), `fk_frontend` (Next.js standalone).

**Artisan на проде:** PHP только внутри контейнера, на хосте его нет. Разовая команда — `docker exec fk_app php artisan <команда>`; для интерактивных подтверждений добавлять `-it` (`docker exec -it fk_app …`).

**Системный nginx** на хосте проксирует: `/api/*` → `127.0.0.1:8000` (Laravel), `/*` → `127.0.0.1:3000` (Next.js).

## Полезные ссылки внутри vault

- [[FK.market]] — Hub (главная)
- [[01 ТЗ]] — техническое задание v0.4
- [[02 Архитектура]] — схема БД, потоки выдачи, fulfillment_modes
- [[03 Дизайн]] — прототипы экранов, бренд-бук
- [[04 Бэкенд]] — как запустить локально, ошибки и решения
- [[05 FKwallet Online Products]] — интеграция API поставщика товаров
- [[06 Авторизация и ЛК]] — план + фактическая реализация OAuth
- [[Журнал решений]] — дневник
- [[Bugs]] — баги (Открытые / Закрытые)
- [[Глоссарий]] — термины (`fulfillment_mode`, `provider`, `SLA`, …)
- [[Roadmap]], [[Kanban]] — планирование

## Парная работа AI ↔ человек

- AI задаёт **вопросы прежде чем кодить**, если есть развилка (особенно архитектурная).
- AI **не делает деструктивные действия** без явного «да» (rm, drop, force push, кредитные действия).
- AI **не использует** `--no-verify`, `--force` push в main, или подобные обходы без явной просьбы.
- Если AI находит баг **не относящийся к текущей задаче** — фиксирует в [[Bugs]] (Открытые) и продолжает текущее.
