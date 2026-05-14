# FK.market — backend

Laravel 11 + MySQL 8 + Redis, всё в Docker. Запускается одной командой.

**Окружения:**
- **Dev (локально):** `http://localhost:8000` — описано ниже.
- **Prod:** сервер `194.87.118.214` (SSH порт `22`). Настройка и деплой — в Фазе 4 (см. [Roadmap в vault](../obsidian/Roadmap.md)).

---

## Быстрый старт

### 1. Требования

- **Docker Desktop** — [скачать](https://www.docker.com/products/docker-desktop/) и установить. После установки запусти его — в трее должен появиться иконка «кит». Компьютер перезагрузи один раз.
- **Ничего больше не нужно** — PHP, Composer, MySQL внутри Docker.

### 2. Запуск

Открой терминал / Powershell в папке `FK.market/backend` и выполни:

```bash
chmod +x setup.sh     # один раз — делает скрипт исполняемым (macOS / Linux)
./setup.sh            # полная установка (первый раз — 2-3 минуты)
```

На Windows в PowerShell: `bash setup.sh` (Docker Desktop ставит bash).

### 3. Что откроется

После успешной установки скрипт напишет адреса:

- **http://localhost:8000** — сайт Laravel
- **http://localhost:8000/api/health** — проверка работы API (должен вернуть `{"status":"ok"}`)
- **http://localhost:8000/api/categories** — список 7 категорий
- **http://localhost:8000/api/products** — каталог товаров (11 посеянных)
- **http://localhost:8000/api/products/chatgpt-plus-1mo** — карточка ChatGPT Plus
- **http://localhost:8080** — phpMyAdmin (login: `root` / password: `root_password`) — можно глазами смотреть БД

### 4. Учётка администратора (создаётся сидом)

```
email:    admin@fk.market
password: admin123
```

Пока нет отдельной админ-авторизации — логин пригодится на следующих шагах.

---

## Что делает `setup.sh` (пошагово)

1. Проверяет, что Docker установлен.
2. Поднимает контейнеры MySQL и Redis, ждёт пока MySQL «очнётся».
3. Если Laravel ещё не установлен — скачивает `laravel/laravel:^11.0` через Composer в папку `src/`.
4. Включает API-роутинг (`php artisan install:api` — ставит Sanctum и создаёт `routes/api.php`).
5. Копирует наши заготовки из `custom/` в `src/`:
   - миграции → `src/database/migrations/`
   - модели Eloquent → `src/app/Models/`
   - сиды → `src/database/seeders/`
   - API-контроллеры → `src/app/Http/Controllers/Api/`
   - роуты → `src/routes/api.php`
6. Копирует `.env.example` → `src/.env` и генерирует `APP_KEY`.
7. Запускает все сервисы (nginx, phpMyAdmin).
8. Выполняет `php artisan migrate:fresh --seed` — создаёт все таблицы и заполняет посевные данные.

Можно смело перезапускать — скрипт идемпотентен.

---

## Полезные команды

```bash
# Остановить всё
docker compose down

# Полный сброс (удалит данные в БД!)
docker compose down -v

# Посмотреть логи приложения
docker compose logs -f app

# Войти внутрь PHP-контейнера
docker compose exec app sh

# Прогнать миграции заново (на пустой БД)
docker compose exec app php artisan migrate:fresh --seed

# Запустить artisan команду
docker compose exec app php artisan list
```

---

## Что уже работает

### Эндпоинты API (публичные, без авторизации)

| Метод | Путь | Что делает |
|-------|------|------------|
| `GET` | `/api/health` | Проверка живости |
| `GET` | `/api/categories` | Список категорий с количеством товаров |
| `GET` | `/api/products` | Листинг каталога |
| `GET` | `/api/products/{slug}` | Карточка товара с отзывами |

### Параметры листинга `/api/products`

| Параметр | Пример | Что делает |
|----------|--------|------------|
| `category` | `ai` | Фильтр по slug-у категории |
| `q` | `claude` | Полнотекстовый поиск по названию/описанию |
| `min_price` / `max_price` | `500` / `2000` | Диапазон цены |
| `mode` | `stock` / `api` / `manual` | Режим выдачи |
| `sort` | `popular` / `price_asc` / `price_desc` / `new` / `rating` | Сортировка |
| `per_page` | `24` | Элементов на странице |

Попробуй: `http://localhost:8000/api/products?category=ai&sort=price_asc`

---

## Структура папки

```
backend/
├── db/
│   ├── schema.sql           - эталонная SQL-схема (для справки)
│   └── er-diagram.html      - визуализация
├── docker/
│   ├── php/Dockerfile       - образ PHP 8.3 с нужными расширениями
│   └── nginx/default.conf   - настройки nginx для Laravel
├── custom/                  - наши наработки поверх стандартного Laravel
│   ├── migrations/          - 5 миграций (все 18 таблиц бизнес-схемы + Laravel-системные)
│   ├── models/              - 20 моделей Eloquent
│   ├── seeders/             - посевные данные (7 категорий + 11 товаров + админ)
│   ├── controllers/         - API-контроллеры каталога
│   └── routes/api.php       - маршруты API
├── src/                     - Laravel-проект (создаётся setup.sh)
├── docker-compose.yml
├── .env.example
├── setup.sh                 - автоустановка
└── README.md                - этот файл
```

Папка `src/` в `.gitignore` не нужна — можно коммитить весь Laravel, включая `vendor/`. Но если хочешь light-репозиторий — исключи `src/vendor/`, `src/node_modules/`, `src/.env`.

---

## Если что-то пошло не так

**«Docker is not running»** — запусти Docker Desktop, подожди пока иконка перестанет крутиться.

**«Port 8000 is already in use»** — что-то занимает порт. Проверь: `lsof -i :8000` (mac/Linux) или `netstat -ano | findstr :8000` (Windows). Либо поменяй порт в `docker-compose.yml` (строка `"8000:80"` → `"8001:80"`).

**«SQLSTATE... Access denied»** — видимо что-то изменил в `.env`. Проще всего `docker compose down -v && ./setup.sh` — полный сброс.

**Миграция падает** — пришли логи (`docker compose logs app`), разберёмся.

---

## Что дальше

Когда этот шаг запустится и ты увидишь JSON на `/api/products` — идём в:

1. **Подключить фронт** — создать Next.js 14 проект в папке `frontend/`, показать на нём главную/каталог/карточку товара из нашего прототипа, подцепить данные из этого API.
2. **Авторизация и личный кабинет** — регистрация, логин, Sanctum-токены, `/api/me`, `/api/orders`.
3. **Оформление заказа и FKwallet** — создание заказа, резервирование ключа, формирование платёжной ссылки, обработка вебхука, выдача.
4. **Админка** — защищённые эндпоинты, роли, CRUD товаров, очередь выдачи.
