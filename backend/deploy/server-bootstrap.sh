#!/usr/bin/env bash
# =========================================================================
# FK.market — первичная настройка продакшн-сервера
# Целевой сервер: 194.87.118.214  (SSH порт 22)
# Запускать на сервере от root (или через sudo).
# Идемпотентно — можно запускать повторно.
# =========================================================================
set -euo pipefail

GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
step() { echo -e "\n${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}WARN${NC} $*"; }

# ---------- 0. Проверки ----------
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}Этот скрипт должен запускаться от root.${NC} Попробуй: sudo bash $0"
  exit 1
fi

# ---------- 1. Параметры ----------
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/fk.market}"
DOMAIN="${DOMAIN:-fk.market}"        # основной домен
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@fk.market}"  # для Let's Encrypt
SSH_PUBKEY_FILE="${SSH_PUBKEY_FILE:-/root/.ssh/authorized_keys}"  # откуда копировать ключ в deploy

step "Параметры"
echo "  DEPLOY_USER   = $DEPLOY_USER"
echo "  APP_DIR       = $APP_DIR"
echo "  DOMAIN        = $DOMAIN"
echo "  ADMIN_EMAIL   = $ADMIN_EMAIL"

# ---------- 2. Обновление системы ----------
step "Обновляю систему (apt update && upgrade)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ---------- 3. Базовые утилиты ----------
step "Ставлю базовые утилиты"
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  git vim htop tmux jq unzip \
  ufw fail2ban rsync \
  nginx certbot python3-certbot-nginx

# ---------- 4. Docker + Docker Compose ----------
if ! command -v docker &>/dev/null; then
  step "Устанавливаю Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null \
   || curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  OS_ID=$(. /etc/os-release; echo "$ID")
  OS_CODENAME=$(. /etc/os-release; echo "$VERSION_CODENAME")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_ID $OS_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  step "Docker уже установлен — пропускаю"
fi

# ---------- 5. Пользователь deploy ----------
if ! id -u "$DEPLOY_USER" &>/dev/null; then
  step "Создаю пользователя $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo,docker "$DEPLOY_USER"
  # позволяем sudo без пароля для docker compose и systemctl restart nginx
  cat > /etc/sudoers.d/$DEPLOY_USER <<EOF
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, /usr/bin/systemctl reload nginx, /usr/bin/certbot
EOF
  chmod 440 /etc/sudoers.d/$DEPLOY_USER
else
  step "Пользователь $DEPLOY_USER уже существует"
  usermod -aG docker "$DEPLOY_USER" || true
fi

# SSH-ключ: копируем root-овский (если есть) в deploy
if [ -s "$SSH_PUBKEY_FILE" ]; then
  step "Копирую SSH-ключ из $SSH_PUBKEY_FILE в ~$DEPLOY_USER"
  mkdir -p "/home/$DEPLOY_USER/.ssh"
  cp "$SSH_PUBKEY_FILE" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 700 "/home/$DEPLOY_USER/.ssh"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
else
  warn "SSH-ключей в $SSH_PUBKEY_FILE нет. Добавь вручную в /home/$DEPLOY_USER/.ssh/authorized_keys"
fi

# ---------- 6. Папка приложения ----------
step "Создаю каталог приложения $APP_DIR"
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# ---------- 7. Firewall (UFW) ----------
step "Настраиваю UFW (открыты 22, 80, 443)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable

# ---------- 8. fail2ban ----------
step "Включаю fail2ban (SSH brute-force защита)"
systemctl enable --now fail2ban

# ---------- 9. SSH hardening ----------
step "Харденинг SSH (отключаю парольную авторизацию root)"
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/'  /etc/ssh/sshd_config
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/'     /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

# ---------- 10. nginx placeholder ----------
step "Включаю nginx (пока дефолтная страница)"
systemctl enable --now nginx

# ---------- 11. Let's Encrypt (только если домен уже указывает на этот сервер) ----------
SERVER_IP=$(curl -s --max-time 5 ifconfig.me || echo "unknown")
DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || echo "")
step "IP сервера: $SERVER_IP | домен $DOMAIN указывает на: ${DOMAIN_IP:-не настроен}"

if [ -n "$DOMAIN_IP" ] && [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
  step "DNS настроен правильно — получаю Let's Encrypt сертификат"
  certbot --nginx --non-interactive --agree-tos --email "$ADMIN_EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" --redirect || warn "certbot не отработал, запусти вручную позже"
else
  warn "DNS пока не указывает на $SERVER_IP — пропускаю Let's Encrypt."
  warn "После настройки A-записи '$DOMAIN → $SERVER_IP' запусти:"
  warn "  certbot --nginx --email $ADMIN_EMAIL -d $DOMAIN -d www.$DOMAIN --redirect --agree-tos"
fi

# ---------- 12. Автообновление сертификатов ----------
step "Включаю cron для автообновления сертификатов"
systemctl enable --now certbot.timer 2>/dev/null || true

# ---------- 13. Итог ----------
echo ""
echo -e "${GREEN}✓ Сервер готов.${NC}"
echo ""
echo "Следующие шаги:"
echo "  1. На своей машине: ssh $DEPLOY_USER@$SERVER_IP  (должно зайти без пароля по ключу)"
echo "  2. Склонировать проект в $APP_DIR"
echo "     su - $DEPLOY_USER"
echo "     git clone <твой_репо> $APP_DIR"
echo "  3. Положить production .env в $APP_DIR/backend/src/.env"
echo "  4. cd $APP_DIR/backend && docker compose up -d"
echo "  5. Проверить: curl -I http://localhost:8000/api/health"
echo ""
echo "Уже работают:"
echo "  • Docker + docker compose"
echo "  • UFW (22/80/443)"
echo "  • fail2ban"
echo "  • nginx"
echo "  • certbot (с авто-обновлением)"
echo "  • SSH только по ключу"
