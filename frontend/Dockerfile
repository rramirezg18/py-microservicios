# ===== 1) Build universal con auto-detección de subcarpeta =====
FROM node:20-alpine AS build
WORKDIR /app

COPY . .

# Detectar carpeta real (scoreboard / angular.json / package.json con Angular)
RUN set -eux; \
  APP_DIR=""; \
  if [ -f scoreboard/angular.json ]; then \
    APP_DIR="scoreboard"; \
  else \
    ANG_DIR="$(find . -maxdepth 3 -type f -name angular.json -print | head -n 1 || true)"; \
    if [ -n "$ANG_DIR" ]; then \
      APP_DIR="$(dirname "$ANG_DIR" | sed 's|^\./||')"; \
    else \
      PKG_ANG="$(find . -maxdepth 3 -type f -name package.json -exec sh -lc 'grep -q \"\\\"@angular/core\\\"\" \"$1\" && echo \"$1\"' sh {} \; | head -n 1 || true)"; \
      if [ -n "$PKG_ANG" ]; then \
        APP_DIR="$(dirname "$PKG_ANG" | sed 's|^\./||')"; \
      else \
        APP_DIR="."; \
      fi; \
    fi; \
  fi; \
  echo "APP_DIR=$APP_DIR" > /tmp/appdir.env

# Instalar dependencias en APP_DIR
RUN set -eux; \
  . /tmp/appdir.env; \
  cd "$APP_DIR"; \
  if [ -f package.json ]; then (npm ci || npm i); fi

# Compilar (Angular → npx -p @angular/cli ng build)
RUN set -eux; \
  . /tmp/appdir.env; \
  cd "$APP_DIR"; \
  if [ -f angular.json ] || ( [ -f package.json ] && grep -q '"@angular/core"' package.json ); then \
    npx -y -p @angular/cli ng version || true; \
    npx -y -p @angular/cli ng build --configuration production || \
    npx -y -p @angular/cli ng build --prod || \
    npx -y -p @angular/cli ng build; \
  elif [ -f package.json ] && grep -q '"vite"' package.json; then \
    npx vite build; \
  elif [ -f package.json ] && grep -q '"react-scripts"' package.json; then \
    npm run build; \
  elif [ -f package.json ] && grep -q '"next"' package.json; then \
    npx next build && npx next export -o dist; \
  elif [ -f package.json ] && npm run | grep -q " build" ; then \
    npm run build; \
  else \
    echo "Sin herramienta de build, se intentará servir estáticos si existen."; \
  fi

# Localizar artefactos y copiarlos a /web
RUN set -eux; \
  . /tmp/appdir.env; \
  cd "$APP_DIR"; \
  mkdir -p /web; \
  if [ -d dist ]; then \
    if find dist -type d -name browser | grep -q .; then \
      ART="$(find dist -type d -name browser | head -n 1)"; \
      cp -R "$ART"/. /web/; \
    else \
      ART="$(find dist -mindepth 1 -maxdepth 1 -type d | head -n 1)"; \
      test -n "$ART"; cp -R "$ART"/. /web/; \
    fi; \
  elif [ -d build ]; then \
    cp -R build/. /web/; \
  elif [ -d public ]; then \
    cp -R public/. /web/; \
  elif [ -f index.html ]; then \
    cp index.html /web/ || true; \
    [ -d assets ] && cp -R assets /web/assets || true; \
    [ -d css ]    && cp -R css    /web/css    || true; \
    [ -d js ]     && cp -R js     /web/js     || true; \
  else \
    echo "No se encontraron artefactos web en $APP_DIR"; \
    ls -la; \
    exit 1; \
  fi

# ===== 2) Nginx: SPA + proxy /api =====
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/ /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
