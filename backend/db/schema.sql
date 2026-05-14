-- ============================================================
-- FK.market — схема базы данных (MVP v0.4)
-- MySQL 8.0+ / InnoDB / utf8mb4
-- ============================================================
-- Рекомендуется применять через Laravel-миграции (поле created_at/updated_at
-- в Laravel 11 создаётся хелпером $table->timestamps()).
-- Ниже — эквивалентный чистый SQL для согласования структуры.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. ПОЛЬЗОВАТЕЛИ И ПРОДАВЦЫ
-- ------------------------------------------------------------

CREATE TABLE users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(190) NOT NULL,
  email_verified_at TIMESTAMP NULL,
  phone             VARCHAR(32) NULL,
  password          VARCHAR(255) NULL,                   -- null если OAuth-only
  name              VARCHAR(120) NULL,
  role              ENUM('customer','admin','seller','moderator') NOT NULL DEFAULT 'customer',
  balance           DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- внутренний баланс в ₽
  is_blocked        TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at     TIMESTAMP NULL,
  remember_token    VARCHAR(100) NULL,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Все пользователи: покупатели, админы, продавцы (v2), модераторы';

-- OAuth-привязки (VK, Яндекс, Telegram)
CREATE TABLE oauth_identities (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  provider    ENUM('vk','yandex','telegram') NOT NULL,
  provider_uid VARCHAR(191) NOT NULL,
  raw_profile JSON NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_oauth_provider_uid (provider, provider_uid),
  KEY idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Продавцы (в v1 один системный, в v2 реальные юзеры)
CREATE TABLE sellers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL,           -- null для системного продавца
  display_name    VARCHAR(120) NOT NULL,
  slug            VARCHAR(120) NOT NULL,
  legal_type      ENUM('platform','individual','self_employed','ie','llc') NOT NULL DEFAULT 'individual',
  legal_info      JSON NULL,                      -- паспорт, ИНН, банковские реквизиты
  commission_pct  DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- комиссия платформы
  rating          DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  reviews_count   INT UNSIGNED NOT NULL DEFAULT 0,
  verified_at     TIMESTAMP NULL,
  status          ENUM('draft','pending','active','blocked') NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sellers_slug (slug),
  KEY idx_sellers_user (user_id),
  CONSTRAINT fk_sellers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. КАТАЛОГ
-- ------------------------------------------------------------

CREATE TABLE categories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id   BIGINT UNSIGNED NULL,
  slug        VARCHAR(120) NOT NULL,
  name        VARCHAR(180) NOT NULL,
  description TEXT NULL,
  icon        VARCHAR(40) NULL,                   -- имя lucide-иконки
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_slug (slug),
  KEY idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id         BIGINT UNSIGNED NOT NULL,           -- в v1 всегда платформенный продавец
  category_id       BIGINT UNSIGNED NOT NULL,
  slug              VARCHAR(180) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  short_description VARCHAR(500) NULL,
  description       MEDIUMTEXT NULL,
  price_base        DECIMAL(12,2) NOT NULL,            -- закупочная цена (если есть)
  markup_pct        DECIMAL(5,2) NULL,                 -- индивидуальная наценка, иначе берётся из pricing_rules
  price_final       DECIMAL(12,2) NOT NULL,            -- денормализованная витринная цена (пересчитывается триггером/джобой)
  price_old         DECIMAL(12,2) NULL,                -- для «скидка N%»
  currency          CHAR(3) NOT NULL DEFAULT 'RUB',
  fulfillment_mode  ENUM('stock','api','manual') NOT NULL,
  fulfillment_fallback ENUM('manual','none') NOT NULL DEFAULT 'none',
  provider_id       BIGINT UNSIGNED NULL,              -- для api-режима
  provider_external_id VARCHAR(191) NULL,              -- id товара у поставщика
  required_params   JSON NULL,                         -- [{name:'steam_login',label:'Логин Steam',type:'string',required:true}, ...]
  status            ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  rating            DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  reviews_count     INT UNSIGNED NOT NULL DEFAULT 0,
  sales_count       INT UNSIGNED NOT NULL DEFAULT 0,
  stock_available   INT NULL,                          -- кэш из stock_items.count (для sort/filter); NULL = безлимит (api)
  published_at      TIMESTAMP NULL,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_products_slug (slug),
  KEY idx_products_status (status),
  KEY idx_products_category (category_id, status),
  KEY idx_products_seller (seller_id, status),
  KEY idx_products_price (price_final),
  KEY idx_products_rating (rating),
  KEY idx_products_fulfillment (fulfillment_mode),
  FULLTEXT KEY ft_products_search (name, short_description, description),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES sellers(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_products_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  url        VARCHAR(500) NOT NULL,
  alt        VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_product_images_product (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Склад ключей/аккаунтов (для fulfillment_mode=stock)
CREATE TABLE stock_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id    BIGINT UNSIGNED NOT NULL,
  payload       TEXT NOT NULL,                    -- ЗАШИФРОВАНО на уровне Laravel Crypt: ключ/логин:пароль/JSON
  note          VARCHAR(500) NULL,                -- служебная заметка (партия, закупка и т.п.)
  is_sold       TINYINT(1) NOT NULL DEFAULT 0,
  sold_order_id BIGINT UNSIGNED NULL,
  sold_at       TIMESTAMP NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_product_avail (product_id, is_sold),
  KEY idx_stock_sold_order (sold_order_id),
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. ПОСТАВЩИКИ И ИНТЕГРАЦИИ
-- ------------------------------------------------------------

CREATE TABLE providers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(60) NOT NULL,           -- 'digiseller', 'kinguin', 'g2g', 'steam_bot'
  name            VARCHAR(120) NOT NULL,
  base_url        VARCHAR(255) NULL,
  credentials     TEXT NULL,                      -- ЗАШИФРОВАНО: api_key, secret, login
  settings        JSON NULL,                      -- таймауты, маппинг полей, лимиты
  is_enabled      TINYINT(1) NOT NULL DEFAULT 1,
  status          ENUM('ok','degraded','error','disabled') NOT NULL DEFAULT 'ok',
  last_sync_at    TIMESTAMP NULL,
  last_error_at   TIMESTAMP NULL,
  last_error_text VARCHAR(500) NULL,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_providers_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Маппинг: товар поставщика → наш товар
CREATE TABLE provider_products (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_id  BIGINT UNSIGNED NOT NULL,
  external_id  VARCHAR(191) NOT NULL,             -- id у поставщика
  product_id   BIGINT UNSIGNED NULL,              -- NULL = ещё не подключён к нашему каталогу
  raw_meta     JSON NULL,                         -- название/категория/цена у поставщика
  price_in     DECIMAL(12,2) NULL,                -- закупочная цена
  in_stock     INT NULL,                          -- остаток у поставщика
  last_seen_at TIMESTAMP NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_external (provider_id, external_id),
  KEY idx_provider_products_product (product_id),
  CONSTRAINT fk_pp_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Лог обращений к API поставщиков
CREATE TABLE provider_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider_id   BIGINT UNSIGNED NOT NULL,
  operation     VARCHAR(60) NOT NULL,             -- 'sync_catalog', 'place_order', 'get_status'
  request       MEDIUMTEXT NULL,
  response      MEDIUMTEXT NULL,
  status_code   SMALLINT NULL,
  success       TINYINT(1) NOT NULL DEFAULT 0,
  latency_ms    INT NULL,
  error_text    VARCHAR(500) NULL,
  related_order_id BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_provider_logs_provider_time (provider_id, created_at),
  KEY idx_provider_logs_order (related_order_id),
  CONSTRAINT fk_pl_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4. ЗАКАЗЫ И ПЛАТЕЖИ
-- ------------------------------------------------------------

CREATE TABLE orders (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_number  VARCHAR(32) NOT NULL,            -- 'FK-2026-08421' (для юзера)
  user_id        BIGINT UNSIGNED NULL,            -- null = гостевой заказ
  email          VARCHAR(190) NOT NULL,           -- куда выдача
  phone          VARCHAR(32) NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'RUB',
  subtotal       DECIMAL(12,2) NOT NULL,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total          DECIMAL(12,2) NOT NULL,
  promocode_id   BIGINT UNSIGNED NULL,
  status         ENUM('pending','paid','fulfilling','completed','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  payment_id     BIGINT UNSIGNED NULL,            -- основной/последний платёж
  utm            JSON NULL,                       -- источник трафика
  ip             VARCHAR(45) NULL,
  user_agent     VARCHAR(500) NULL,
  paid_at        TIMESTAMP NULL,
  completed_at   TIMESTAMP NULL,
  created_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_orders_public_number (public_number),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_promocode FOREIGN KEY (promocode_id) REFERENCES promocodes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id     BIGINT UNSIGNED NOT NULL,
  product_id   BIGINT UNSIGNED NOT NULL,
  seller_id    BIGINT UNSIGNED NOT NULL,          -- для v2 раскладки выручки по продавцам
  qty          INT UNSIGNED NOT NULL DEFAULT 1,
  price        DECIMAL(12,2) NOT NULL,            -- цена за 1 шт на момент заказа
  price_in     DECIMAL(12,2) NULL,                -- себестоимость, для расчёта маржи
  total        DECIMAL(12,2) NOT NULL,
  params       JSON NULL,                         -- значения required_params ({steam_login:'xxx'})
  stock_item_id BIGINT UNSIGNED NULL,             -- привязка к выданному ключу, если fulfillment=stock
  provider_order_id VARCHAR(191) NULL,            -- id заказа у поставщика, если fulfillment=api
  fulfillment_status ENUM('pending','queued','in_progress','delivered','failed') NOT NULL DEFAULT 'pending',
  delivered_payload TEXT NULL,                    -- ЗАШИФРОВАНО: итоговый код/логин/ссылка
  delivered_at TIMESTAMP NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  KEY idx_order_items_seller (seller_id),
  KEY idx_order_items_fulfillment (fulfillment_status),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_oi_seller FOREIGN KEY (seller_id) REFERENCES sellers(id),
  CONSTRAINT fk_oi_stock FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id          BIGINT UNSIGNED NOT NULL,
  provider          ENUM('fkwallet','fkwallet_wallet','balance','manual') NOT NULL DEFAULT 'fkwallet',
  method            VARCHAR(40) NULL,              -- 'card', 'sbp', 'crypto', 'wallet'
  provider_payment_id VARCHAR(191) NULL,           -- id платежа у FKwallet
  amount            DECIMAL(12,2) NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'RUB',
  status            ENUM('pending','authorized','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  redirect_url      VARCHAR(500) NULL,             -- URL оплаты
  raw_request       JSON NULL,
  raw_response      JSON NULL,
  paid_at           TIMESTAMP NULL,
  failed_reason     VARCHAR(500) NULL,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_order (order_id),
  KEY idx_payments_status (status),
  KEY idx_payments_provider_id (provider, provider_payment_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Выплаты продавцам (v2)
CREATE TABLE payouts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id        BIGINT UNSIGNED NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'RUB',
  provider         ENUM('fkwallet_payout','manual') NOT NULL DEFAULT 'fkwallet_payout',
  method           VARCHAR(40) NULL,               -- 'card', 'wallet'
  destination      VARCHAR(191) NULL,              -- номер карты/кошелька
  provider_payout_id VARCHAR(191) NULL,
  status           ENUM('requested','processing','paid','failed','cancelled') NOT NULL DEFAULT 'requested',
  raw_response     JSON NULL,
  processed_at     TIMESTAMP NULL,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payouts_seller (seller_id),
  KEY idx_payouts_status (status),
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 5. ОЧЕРЕДЬ ВЫДАЧИ
-- ------------------------------------------------------------

-- Задача на выдачу (ручную или через API) — одна на order_item
CREATE TABLE fulfillment_tasks (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_item_id    BIGINT UNSIGNED NOT NULL,
  mode             ENUM('api','manual') NOT NULL,
  provider_id      BIGINT UNSIGNED NULL,
  status           ENUM('queued','in_progress','done','failed','cancelled') NOT NULL DEFAULT 'queued',
  assignee_id      BIGINT UNSIGNED NULL,          -- админ, взявший в работу
  input_params     JSON NULL,                      -- копия order_items.params для удобства
  result           JSON NULL,                      -- что именно выдали (key, trade_id, screenshot_url)
  retries          INT UNSIGNED NOT NULL DEFAULT 0,
  error_text       VARCHAR(500) NULL,
  deadline_at      TIMESTAMP NULL,                 -- SLA
  started_at       TIMESTAMP NULL,
  finished_at      TIMESTAMP NULL,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ft_order_item (order_item_id),
  KEY idx_ft_status (status),
  KEY idx_ft_assignee (assignee_id),
  KEY idx_ft_deadline (deadline_at),
  CONSTRAINT fk_ft_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_ft_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_ft_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 6. ОТЗЫВЫ, ПРОМО, НАСТРОЙКИ
-- ------------------------------------------------------------

CREATE TABLE reviews (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id   BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  order_id     BIGINT UNSIGNED NOT NULL,           -- отзыв только от того, кто покупал
  rating       TINYINT UNSIGNED NOT NULL,          -- 1..5
  text         TEXT NULL,
  is_approved  TINYINT(1) NOT NULL DEFAULT 1,      -- премодерация отключаемая
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_reviews_product_user_order (product_id, user_id, order_id),
  KEY idx_reviews_product (product_id, is_approved),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE promocodes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(60) NOT NULL,
  type         ENUM('percent','fixed') NOT NULL,
  value        DECIMAL(10,2) NOT NULL,              -- процент или рубли
  min_total    DECIMAL(12,2) NULL,                  -- минимальная сумма заказа
  max_discount DECIMAL(12,2) NULL,                  -- потолок для %
  limit_total  INT UNSIGNED NULL,                   -- сколько раз можно использовать всего
  limit_per_user INT UNSIGNED NULL,
  used_count   INT UNSIGNED NOT NULL DEFAULT 0,
  category_ids JSON NULL,                           -- привязка к категориям
  product_ids  JSON NULL,                           -- привязка к товарам
  valid_from   TIMESTAMP NULL,
  valid_until  TIMESTAMP NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_promocodes_code (code),
  KEY idx_promocodes_active (is_active, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Правила наценок: глобально, по категории, по продавцу, по товару
CREATE TABLE pricing_rules (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scope        ENUM('global','category','seller','product') NOT NULL,
  scope_id     BIGINT UNSIGNED NULL,                -- id категории/продавца/товара, null для global
  markup_pct   DECIMAL(5,2) NOT NULL,
  priority     INT NOT NULL DEFAULT 0,              -- при конфликтах выигрывает больший priority
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pricing_scope (scope, scope_id),
  KEY idx_pricing_active (is_active, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settings (
  `key`        VARCHAR(120) NOT NULL PRIMARY KEY,
  value        TEXT NULL,
  type         ENUM('string','int','bool','json') NOT NULL DEFAULT 'string',
  description  VARCHAR(500) NULL,
  updated_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,               -- кто сделал
  action       VARCHAR(120) NOT NULL,              -- 'product.update', 'order.refund'
  subject_type VARCHAR(60) NULL,                   -- 'Product', 'Order'
  subject_id   BIGINT UNSIGNED NULL,
  payload      JSON NULL,                          -- diff
  ip           VARCHAR(45) NULL,
  user_agent   VARCHAR(500) NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user (user_id),
  KEY idx_audit_subject (subject_type, subject_id),
  KEY idx_audit_action (action),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 7. СИСТЕМНЫЕ ТАБЛИЦЫ LARAVEL (для справки — создаются фреймворком)
-- ------------------------------------------------------------
-- personal_access_tokens (Sanctum) — API-токены
-- jobs / failed_jobs (очереди)
-- password_reset_tokens
-- migrations
-- ------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- ИТОГО: 18 бизнес-таблиц + 5 системных (Laravel)
-- ============================================================
