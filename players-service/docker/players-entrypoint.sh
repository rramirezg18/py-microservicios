#!/usr/bin/env bash
set -e
cd /var/www/html

# 0) Permisos y limpieza ANTES de cualquier artisan
chown -R application:application storage bootstrap/cache || true
chmod -R ug+rwX storage bootstrap/cache || true
rm -f bootstrap/cache/*.php || true
# limpia nombres fantasmas copiados desde Windows (si existen)
find . -maxdepth 1 -type f -name "C:*" -delete || true
find . -maxdepth 1 -type d -name "C:*" -exec rm -rf {} + || true
: > storage/logs/laravel.log || true

# 1) Si no hay .env, créalo
[ -f .env ] || cp .env.example .env

# 2) Inyectar variables (DB, etc.)
[ -n "$DB_CONNECTION" ] && sed -i "s/^DB_CONNECTION=.*/DB_CONNECTION=${DB_CONNECTION}/" .env || true
[ -n "$DB_HOST" ]       && sed -i "s/^DB_HOST=.*/DB_HOST=${DB_HOST}/" .env || true
[ -n "$DB_PORT" ]       && sed -i "s/^DB_PORT=.*/DB_PORT=${DB_PORT}/" .env || true
[ -n "$DB_DATABASE" ]   && sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_DATABASE}/" .env || true
[ -n "$DB_USERNAME" ]   && sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USERNAME}/" .env || true
[ -n "$DB_PASSWORD" ]   && sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" .env || true

# Fuerza entorno prod + logs a stderr (opcional pero recomendado en contenedor)
grep -q "^APP_ENV=" .env && sed -i "s/^APP_ENV=.*/APP_ENV=production/" .env || echo "APP_ENV=production" >> .env
grep -q "^APP_DEBUG=" .env && sed -i "s/^APP_DEBUG=.*/APP_DEBUG=false/" .env || echo "APP_DEBUG=false" >> .env
grep -q "^LOG_CHANNEL=" .env && sed -i "s/^LOG_CHANNEL=.*/LOG_CHANNEL=stderr/" .env || echo "LOG_CHANNEL=stderr" >> .env
grep -q "^CACHE_DRIVER=" .env || echo "CACHE_DRIVER=file" >> .env
grep -q "^SESSION_DRIVER=" .env || echo "SESSION_DRIVER=file" >> .env
grep -q "^QUEUE_CONNECTION=" .env || echo "QUEUE_CONNECTION=sync" >> .env

# 3) APP_KEY (ya sin caches)
if ! grep -q "^APP_KEY=base64:" .env; then
  php artisan key:generate --force || true
fi

# 4) Limpiar caches de Laravel (ahora sí pueden correr)
php artisan config:clear || true
php artisan cache:clear  || true
php artisan route:clear  || true
php artisan package:discover --ansi || true

# 5) Esperar DB y migrar
echo "⏳ Esperando MySQL en ${DB_HOST}:${DB_PORT:-3306}..."
until php -r '
$h=getenv("DB_HOST"); $p=getenv("DB_PORT")?:3306;
$db=getenv("DB_DATABASE"); $u=getenv("DB_USERNAME"); $pw=getenv("DB_PASSWORD");
try { new PDO("mysql:host=$h;port=$p;dbname=$db;charset=utf8mb4",$u,$pw,[PDO::ATTR_TIMEOUT=>2]); } catch (Throwable $e) { exit(1); }
'; do sleep 2; done
echo "✅ MySQL disponible."

php artisan migrate --force || true

# 6) Encadenar al entrypoint original de la base webdevops
exec /entrypoint "$@"
