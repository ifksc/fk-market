# Деплой FK.market на сервер 194.87.118.214

Пошаговая инструкция от голого VPS до работающего сайта.

## Что у тебя должно быть

- Доступ к серверу `194.87.118.214` (SSH порт `22`) — логин/пароль root **или** SSH-ключ.
- SSH-клиент (Terminal на macOS уже установлен).
- Твой публичный SSH-ключ в `~/.ssh/id_ed25519.pub` или `~/.ssh/id_rsa.pub`. Если нет — сгенерировать: `ssh-keygen -t ed25519` (жми Enter на все вопросы).

## Шаг 1. Первый SSH на сервер

Если у тебя пока **только пароль**:
```bash
ssh root@194.87.118.214
```
Введи пароль. На сервере выполни (один раз, чтобы потом заходить без пароля):
```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys  # теперь вставь содержимое файла ~/.ssh/id_ed25519.pub со своей машины и нажми Ctrl+D
chmod 600 ~/.ssh/authorized_keys
exit
```

Теперь `ssh root@194.87.118.214` зайдёт без пароля.

## Шаг 2. Загрузить и запустить bootstrap-скрипт

На **своей машине**, в папке проекта:
```bash
scp "/Users/lavrov/Documents/Claude/Projects/FK.market/backend/deploy/server-bootstrap.sh" root@194.87.118.214:/tmp/
ssh root@194.87.118.214 "bash /tmp/server-bootstrap.sh"
```

Параметры можно переопределить через переменные окружения:
```bash
ssh root@194.87.118.214 "DOMAIN=fk.market ADMIN_EMAIL=kscandroid@gmail.com bash /tmp/server-bootstrap.sh"
```

Скрипт за 2-3 минуты:
- обновит систему
- поставит **Docker + docker compose**
- создаст пользователя **`deploy`** с SSH-ключом и доступом к Docker
- настроит **firewall** (открыты только 22/80/443)
- включит **fail2ban** против брутфорса SSH
- **запретит логин по паролю** (только по ключу)
- поставит **nginx** и **certbot** (Let's Encrypt)
- если DNS `fk.market` уже указывает на сервер — **автоматически получит SSL**

## Шаг 3. DNS (один раз, у регистратора домена)

У регистратора домена (nic.ru / reg.ru / namecheap / …) добавь две A-записи:

| Host | Type | Value |
|------|------|-------|
| `@` (root) | A | `194.87.118.214` |
| `www` | A | `194.87.118.214` |
| `api` | A | `194.87.118.214` |

DNS обновляется от 5 минут до нескольких часов. Проверить:
```bash
dig +short fk.market      # должно вернуть 194.87.118.214
dig +short api.fk.market  # должно вернуть 194.87.118.214
```

## Шаг 4. Заполнить nginx-конфиг и выпустить SSL

На сервере:
```bash
ssh deploy@194.87.118.214

# Скопировать конфиг из репозитория
sudo cp /opt/fk.market/backend/deploy/nginx-fk.market.conf /etc/nginx/sites-available/fk.market
sudo ln -sf /etc/nginx/sites-available/fk.market /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL для всех поддоменов
sudo certbot --nginx -d fk.market -d www.fk.market -d api.fk.market \
    --agree-tos --email kscandroid@gmail.com --redirect --non-interactive
```

## Шаг 5. Клонировать проект и поднять контейнеры

На сервере от пользователя `deploy`:
```bash
cd /opt/fk.market
git clone https://github.com/<твой-аккаунт>/fk.market.git .   # когда будет репозиторий
cd backend
cp .env.example src/.env
# отредактировать src/.env: APP_ENV=production, APP_DEBUG=false, APP_URL=https://fk.market,
#   DB_PASSWORD, FKwallet ключи, OAuth ключи
nano src/.env

# Первый запуск (подтянет Laravel, миграции, сиды)
chmod +x ../backend/setup.sh
../backend/setup.sh
```

> [!warning] Сиды на проде
> `setup.sh` делает `migrate:fresh --seed`. На продакшне это **удалит реальные данные**. На prod-сервере вместо него запускать:
> ```bash
> docker compose up -d
> docker compose exec app php artisan migrate --force
> docker compose exec app php artisan config:cache
> ```

## Шаг 6. Проверить что всё работает

```bash
curl -I https://fk.market
curl -I https://api.fk.market/api/health
```

Должны вернуть `200 OK`.

## Дальше — обновление кода

Каждый раз, когда ты коммитишь новую версию в git:

**Вариант А (вручную):**
```bash
ssh deploy@194.87.118.214
cd /opt/fk.market/backend/deploy
./deploy.sh
```

**Вариант Б (одной командой со своей машины):**
```bash
ssh deploy@194.87.118.214 'cd /opt/fk.market/backend/deploy && ./deploy.sh'
```

`deploy.sh` делает: `git pull` → `docker compose build && up -d` → `migrate` → кэши.

## Полезные SSH-алиасы (на твоей машине)

В `~/.ssh/config` добавь:
```
Host fk-prod
  HostName 194.87.118.214
  Port 22
  User deploy
  IdentityFile ~/.ssh/id_ed25519
```

После этого: `ssh fk-prod` — готово.

## Безопасность — что уже сделано

| | Статус |
|---|---|
| SSH только по ключу (паролем запрещено) | ✓ |
| Root login только по ключу | ✓ |
| Firewall (ufw) открывает только 22/80/443 | ✓ |
| fail2ban против SSH-брутфорса | ✓ |
| Автоматическое обновление SSL-сертификатов | ✓ |
| Application-level: хэширование паролей, шифрование ключей | ✓ (Laravel) |

## Чего пока не сделано (добавим когда понадобится)

- [ ] Ежедневные бэкапы БД (`mysqldump` → S3 / объектное хранилище)
- [ ] Мониторинг uptime (UptimeRobot / betterstack)
- [ ] Sentry для отслеживания PHP-ошибок
- [ ] Staging-окружение (на том же сервере, отдельный compose-проект)
- [ ] CI/CD (GitHub Actions: `git push → ssh deploy → ./deploy.sh`)

## Если что-то пошло не так

- **`certbot` не получил сертификат** — проверь что DNS уже указывает на сервер (`dig +short fk.market`).
- **`502 Bad Gateway` в браузере** — Laravel или Next.js контейнер не запущен. Смотри `docker compose ps` и `docker compose logs app`.
- **`Connection refused` по SSH** — проверь что ты из белого списка / не забанил себя в ufw.
