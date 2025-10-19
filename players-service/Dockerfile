# ==== Etapa 1: vendor con Composer ====
FROM composer:2 AS vendor
WORKDIR /app
# Copiamos solo lo necesario para cachear deps
COPY composer.json composer.lock ./
# Instala dependencias de PHP sin dev; ignora reqs de plataforma para que no falle por extensiones
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --no-scripts --ignore-platform-reqs

# ==== Etapa 2: runtime con webdevops (Apache+PHP-FPM+supervisor) ====
FROM webdevops/php-apache:8.2

# Laravel sirve desde /public
ENV WEB_DOCUMENT_ROOT=/var/www/html/public
WORKDIR /var/www/html

# Código + vendor generado en la etapa anterior
COPY . .
COPY --from=vendor /app/vendor /var/www/html/vendor

# Entrypoint propio (genera .env, APP_KEY, espera MySQL, corre migraciones)
COPY docker/players-entrypoint.sh /usr/local/bin/players-entrypoint.sh
RUN chmod +x /usr/local/bin/players-entrypoint.sh

# Muy importante: tu entrypoint DEBE encadenar al de webdevops (/entrypoint)
ENTRYPOINT ["/usr/local/bin/players-entrypoint.sh"]
# Dejamos el CMD por defecto de la base (supervisord). Si prefieres, explícitalo:
CMD ["supervisord"]
