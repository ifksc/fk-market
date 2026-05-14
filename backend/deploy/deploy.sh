#!/usr/bin/env bash
# FK.market — деплой обновлений на продакшн-сервер
# Запуск: ./deploy.sh
# Должен выполняться на сервере 194.87.118.214 из-под пользователя deploy.
set -euo pipefail

GREEN="\033[0;32m"; NC="\033[0m"
cd "$(dirname "$0")/.."   # переход в backend/

echo -e "${GREEN}==>${NC} git pull"
git -C .. pull --ff-only

echo -e "${GREEN}==>${NC} docker compose build && up"
docker compose up -d --build

echo -e "${GREEN}==>${NC} php artisan migrate --force"
docker compose exec -T app php artisan migrate --force

echo -e "${GREEN}==>${NC} php artisan config:cache && route:cache && view:cache"
docker compose exec -T app php artisan config:cache
docker compose exec -T app php artisan route:cache
docker compose exec -T app php artisan view:cache

echo -e "${GREEN}==>${NC} docker compose ps"
docker compose ps

echo ""
echo -e "${GREEN}✓ Деплой завершён${NC}"
