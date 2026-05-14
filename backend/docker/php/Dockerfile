FROM php:8.3-fpm-alpine

# ---------- Runtime библиотеки (остаются в образе) ----------
RUN apk add --no-cache \
    bash git curl zip unzip mysql-client \
    libpng libjpeg-turbo freetype \
    libzip oniguruma icu-libs

# ---------- Build-зависимости + расширения PHP (build-deps удаляются в конце) ----------
RUN apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        libpng-dev libjpeg-turbo-dev freetype-dev \
        libzip-dev oniguruma-dev icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mbstring \
        bcmath \
        gd \
        zip \
        intl \
        opcache \
        pcntl \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del --purge .build-deps \
    && rm -rf /tmp/* /var/cache/apk/*

# ---------- Composer ----------
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# ---------- Рабочая директория и пользователь ----------
WORKDIR /var/www/html

RUN addgroup -g 1000 -S www && adduser -u 1000 -S www -G www
USER www

CMD ["php-fpm"]
