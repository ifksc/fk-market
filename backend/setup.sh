#!/usr/bin/env bash
# FK.market — автоустановка Laravel-приложения
# Запуск: ./setup.sh
set -e

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"

echo -e "${GREEN}==> FK.market backend setup${NC}"

# 0. Проверки
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Ошибка: Docker не установлен.${NC}"
  echo "Скачайте Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker compose version &> /dev/null; then
  echo -e "${RED}Ошибка: Docker Compose v2 не найден.${NC}"
  exit 1
fi

# 1. Поднимаем контейнеры
echo -e "${YELLOW}1/6 Запускаю Docker-контейнеры...${NC}"
docker compose up -d mysql redis
# ждём пока mysql поднимется (healthcheck)
echo "   жду MySQL..."
for i in {1..30}; do
  if docker compose exec -T mysql mysqladmin ping -h localhost -uroot -proot_password &> /dev/null; then
    break
  fi
  sleep 2
done

# 2. Устанавливаем Laravel, если ещё не установлен
if [ ! -f "src/artisan" ]; then
  echo -e "${YELLOW}2/6 Устанавливаю Laravel 11 в ./src (это 1-2 минуты)...${NC}"
  mkdir -p src
  # composer create-project требует пустую директорию → ставим во временную /tmp/laravel
  # и сразу копируем в /var/www/html (bind-mount на ./src). Всё в одном контейнере.
  docker compose run --rm --user root app sh -c "
    composer create-project --prefer-dist laravel/laravel:^11.0 /tmp/laravel \
    && cp -a /tmp/laravel/. /var/www/html/ \
    && chown -R www:www /var/www/html
  "
else
  echo -e "${GREEN}2/6 Laravel уже установлен, пропускаю.${NC}"
fi

# 3. Включаем API-роутинг Laravel 11 (создаёт routes/api.php и ставит Sanctum)
if [ ! -f "src/routes/api.php" ]; then
  echo -e "${YELLOW}3a/6 Включаю API-роутинг Laravel (install:api)...${NC}"
  docker compose up -d app
  docker compose exec -T app php artisan install:api --no-interaction || true
fi

# 3b. Копируем наши custom-файлы (миграции, модели, сиды, API)
echo -e "${YELLOW}3b/6 Копирую наши миграции / модели / сиды / роуты...${NC}"
# дефолтную миграцию users заменяем нашей (у нас больше полей)
rm -f src/database/migrations/0001_01_01_000000_create_users_table.php
if [ -d "custom/migrations" ]; then
  cp -f custom/migrations/*.php src/database/migrations/
fi
if [ -d "custom/models" ]; then
  mkdir -p src/app/Models
  cp -f custom/models/*.php src/app/Models/
fi
if [ -d "custom/seeders" ]; then
  cp -f custom/seeders/*.php src/database/seeders/
fi
if [ -d "custom/controllers" ]; then
  mkdir -p src/app/Http/Controllers/Api
  cp -rf custom/controllers/* src/app/Http/Controllers/Api/
fi
if [ -f "custom/routes/api.php" ]; then
  cp -f custom/routes/api.php src/routes/api.php
fi

# 4. .env
if [ ! -f "src/.env" ]; then
  echo -e "${YELLOW}4/6 Создаю .env из шаблона...${NC}"
  cp .env.example src/.env
  docker compose up -d app
  docker compose exec -T app php artisan key:generate
else
  echo -e "${GREEN}4/6 .env уже есть, пропускаю.${NC}"
fi

# 5. Поднимаем nginx и остальное
echo -e "${YELLOW}5/6 Поднимаю все сервисы...${NC}"
docker compose up -d

# 6. Миграции и сиды
echo -e "${YELLOW}6/6 Применяю миграции и посевные данные...${NC}"
docker compose exec -T app php artisan migrate:fresh --seed --force

echo ""
echo -e "${GREEN}✓ Установка завершена!${NC}"
echo ""
echo "📦 Сайт:        http://localhost:8000"
echo "🔎 phpMyAdmin:  http://localhost:8080  (root / root_password)"
echo "📨 API каталог: http://localhost:8000/api/products"
echo ""
echo "Остановить:     docker compose down"
echo "Логи:           docker compose logs -f app"
echo "Войти в PHP:    docker compose exec app sh"
echo ""
